import { StrictMode, useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Plate, PlateContent, createPlateEditor } from "platejs/react";
import { slateRangeToRelativeRange } from "@slate-yjs/core";
import * as Y from "yjs";
import { useComparisonCollaboration, RemoteComparisonCursors } from "./collaboration-session";

const providers = vi.hoisted(
  () => [] as Array<{ options: Record<string, any>; awareness: any; destroy: ReturnType<typeof vi.fn> }>
);
vi.mock("@hocuspocus/provider", () => ({
  HocuspocusProvider: class {
    options: Record<string, any>;
    awareness = {
      states: new Map(),
      listeners: new Set<() => void>(),
      getStates: () => this.awareness.states,
      on: (_event: string, fn: () => void) => this.awareness.listeners.add(fn),
      off: (_event: string, fn: () => void) => this.awareness.listeners.delete(fn),
      setLocalStateField: vi.fn(),
      setLocalState: vi.fn(),
    };
    destroy = vi.fn();
    connect = vi.fn();
    constructor(options: Record<string, any>) {
      this.options = options;
      providers.push(this);
    }
  },
}));
const room = {
  url: "ws://localhost:3100/live",
  name: "test",
  token: "identity",
  user: { id: "me", name: "Me", avatar: "", color: "#2563eb" },
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  providers.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function Harness({ editor }: { editor: ReturnType<typeof createPlateEditor> }) {
  const container = useRef<HTMLDivElement>(null);
  const state = useComparisonCollaboration(editor, room, container);
  return (
    <div ref={container}>
      <output>{state.status}</output>
      <RemoteComparisonCursors cursors={state.cursors} />
    </div>
  );
}
function synchronize() {
  const provider = providers.at(-1)!;
  const doc = provider.options.document as Y.Doc;
  doc.get("content", Y.XmlText).applyDelta([{ insert: new Y.XmlText("hello"), attributes: { type: "p" } }]);
  provider.options.onSynced({ state: true });
  return provider;
}
it("stays unsynchronized until server sync, handles denial and disconnect, cleans up in StrictMode", async () => {
  const editor = createPlateEditor();
  const view = render(
    <StrictMode>
      <Harness editor={editor} />
    </StrictMode>
  );
  expect(screen.getByText("connecting")).toBeTruthy();
  await act(async () => synchronize());
  expect(screen.getByText("synced")).toBeTruthy();
  expect(editor.api.string([])).toBe("hello");
  const provider = providers.at(-1)!;
  act(() => {
    provider.options.onAuthenticationFailed();
    provider.options.onClose();
  });
  expect(screen.getByText("error")).toBeTruthy();
  act(() => provider.options.onStatus({ status: "connecting" }));
  expect(screen.getByText("connecting")).toBeTruthy();
  act(() => provider.options.onClose());
  expect(screen.getByText("disconnected")).toBeTruthy();
  view.unmount();
  expect(provider.destroy).toHaveBeenCalledOnce();
  expect(provider.awareness.listeners.size).toBe(0);
});
it("positions remote selection and avatar from DOM ranges and remeasures on scroll", async () => {
  const editor = createPlateEditor();
  const dom = {
    getClientRects: () => [new DOMRect(20, 40, 50, 18)],
    getBoundingClientRect: () => new DOMRect(70, 40, 0, 18),
  };
  vi.spyOn(editor.api, "toDOMRange").mockReturnValue(dom as unknown as Range);
  const view = render(<Harness editor={editor} />);
  let provider: (typeof providers)[number];
  await act(async () => {
    provider = synchronize();
  });
  await act(async () => {
    provider!.awareness.states.set(42, {
      user: { id: "other", name: "Remote member", avatar: "" },
      selection: slateRangeToRelativeRange((provider!.options.document as Y.Doc).get("content", Y.XmlText), editor, {
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 4 },
      }),
    });
    provider!.awareness.listeners.forEach((fn: () => void) => fn());
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  expect(screen.getByText("Remote member")).toBeTruthy();
  expect(view.container.querySelector("[data-remote-cursor='42'] > span:last-child")?.getAttribute("style")).toContain(
    "left: 70px"
  );
  dom.getBoundingClientRect = () => new DOMRect(80, 20, 0, 18);
  await act(async () => {
    window.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  expect(view.container.querySelector("[data-remote-cursor='42'] > span:last-child")?.getAttribute("style")).toContain(
    "left: 80px"
  );
  act(() => provider!.options.onClose());
  expect(screen.queryByText("Remote member")).toBeNull();
});

it("flushes real mounted Plate operations without manual Yjs flushing and publishes selection", async () => {
  const editor = createPlateEditor();
  function MountedEditor() {
    const container = useRef<HTMLDivElement>(null);
    const state = useComparisonCollaboration(editor, room, container);
    return (
      <div ref={container}>
        <Plate
          editor={editor}
          onChange={state.onChange}
          onSelectionChange={state.onChange}
          readOnly={state.status !== "synced"}
        >
          <PlateContent />
        </Plate>
      </div>
    );
  }
  const view = render(<MountedEditor />);
  expect(view.container.querySelector('[contenteditable="false"]')).toBeTruthy();
  await act(async () => synchronize());
  await act(async () => editor.tf.insertText(" world", { at: { path: [0, 0], offset: 5 } }));
  const provider = providers.at(-1)!;
  const root = (provider.options.document as Y.Doc).get("content", Y.XmlText);
  expect(root.toString()).toContain("hello world");
  await act(async () => editor.tf.select({ path: [0, 0], offset: 6 }));
  expect(provider.awareness.setLocalStateField).toHaveBeenCalledWith(
    "selection",
    expect.objectContaining({ anchor: expect.any(Object) })
  );
  view.container.firstElementChild?.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
  expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith("selection", null);
  provider.awareness.setLocalStateField.mockClear();
  view.container.firstElementChild?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith(
    "selection",
    expect.objectContaining({ anchor: expect.any(Object) })
  );
  provider.awareness.setLocalStateField.mockClear();
  const before = Y.encodeStateAsUpdate(provider.options.document);
  await act(async () => editor.tf.move({ distance: 1, unit: "offset" }));
  expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith(
    "selection",
    expect.objectContaining({ anchor: expect.any(Object) })
  );
  expect(Y.encodeStateAsUpdate(provider.options.document)).toEqual(before);
});

it("does not reconnect when consumer callbacks change", async () => {
  const editor = createPlateEditor();
  const first = vi.fn(),
    second = vi.fn();
  function CallbackHarness({ callback }: { callback: (payload: string) => void }) {
    const container = useRef<HTMLDivElement>(null);
    useComparisonCollaboration(editor, { ...room, onStateless: callback }, container);
    return <div ref={container} />;
  }
  const view = render(<CallbackHarness callback={first} />);
  const count = providers.length;
  const provider = providers.at(-1)!;
  view.rerender(<CallbackHarness callback={second} />);
  expect(providers.length).toBe(count);
  expect(provider.destroy).not.toHaveBeenCalled();
  provider.options.onStateless({ payload: "saved" });
  expect(second).toHaveBeenCalledWith("saved");
  expect(first).not.toHaveBeenCalled();
});
