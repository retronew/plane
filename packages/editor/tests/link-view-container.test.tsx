import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, expect, it, vi } from "vitest";
import { LinkViewContainer } from "../src/components/editors/link-view-container";

vi.mock("@tiptap/react", () => ({
  useEditorState: ({ editor, selector }: { editor: Editor; selector: (value: { editor: Editor }) => unknown }) =>
    selector({ editor }),
}));
vi.mock("@floating-ui/react", () => ({
  autoUpdate: vi.fn(),
  flip: vi.fn(),
  hide: vi.fn(),
  shift: vi.fn(),
  useDismiss: vi.fn(),
  useInteractions: () => ({ getReferenceProps: () => ({}), getFloatingProps: () => ({}) }),
  useFloating: () => ({ refs: { setFloating: vi.fn(), floating: { current: null } }, floatingStyles: {}, context: {} }),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup() {
  const storage = { isBubbleMenuOpen: false, isPreviewOpen: false };
  const mark = { type: { name: "link" }, attrs: { href: "https://old.example" } };
  const editor = {
    storage: { link: storage },
    view: { posAtDOM: () => 1, state: { doc: { nodeAt: () => ({ marks: [mark], text: "link", nodeSize: 4 }) } } },
  } as unknown as Editor;
  const container = document.createElement("div");
  const anchor = document.createElement("a");
  container.append(anchor);
  document.body.append(container);
  const containerRef = { current: container };
  const view = render(<LinkViewContainer editor={editor} containerRef={containerRef} />);
  return {
    storage,
    mark,
    anchor,
    container,
    view,
    rerender: () => view.rerender(<LinkViewContainer editor={editor} containerRef={containerRef} />),
  };
}
it("refreshes the URL when the same link range changes", () => {
  const { anchor, mark, container } = setup();
  fireEvent.mouseOver(anchor);
  expect(screen.getByText(/https:\/\//).textContent).toBe("https://old.example");
  mark.attrs.href = "https://new.example";
  fireEvent.mouseOver(anchor);
  expect(screen.getByText(/https:\/\//).textContent).toBe("https://new.example");
  container.remove();
});
it("closes when the pointer leaves the window", () => {
  vi.useFakeTimers();
  const { anchor, container } = setup();
  fireEvent.mouseOver(anchor);
  fireEvent.mouseLeave(container, { relatedTarget: null });
  act(() => vi.advanceTimersByTime(400));
  expect(screen.queryByText(/https:\/\//)).toBeNull();
  container.remove();
});
it("closes when the mutable storage reports that the bubble menu opened", () => {
  const { anchor, storage, rerender, container } = setup();
  fireEvent.mouseOver(anchor);
  storage.isBubbleMenuOpen = true;
  rerender();
  expect(screen.queryByText(/https:\/\//)).toBeNull();
  container.remove();
});
