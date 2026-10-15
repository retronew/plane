import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EditorRefApi } from "@plane/editor";
import { StickyEditorToolbar } from "./toolbar";
import { ColorPalette } from "./color-palette";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
beforeEach(() => {
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());
it("reflects initial and subsequent editor formatting and dispatches actions", () => {
  const active = new Set(["bold"]);
  let notify = () => {};
  const unsubscribe = vi.fn();
  const editor = {
    isMenuItemActive: ({ itemKey }: { itemKey: string }) => active.has(itemKey),
    onStateChange: (callback: () => void) => {
      notify = callback;
      return unsubscribe;
    },
  } as unknown as EditorRefApi;
  const execute = vi.fn(),
    remove = vi.fn();
  const view = render(
    <StickyEditorToolbar
      editorRef={editor}
      executeCommand={execute}
      handleColorChange={vi.fn()}
      handleDelete={remove}
    />
  );
  const bold = screen.getByRole("button", { name: "stickies.toolbar.bold" });
  expect(bold.getAttribute("aria-pressed")).toBe("true");
  act(() => {
    active.clear();
    notify();
  });
  expect(bold.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(bold);
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ itemKey: "bold" }));
  fireEvent.click(screen.getByRole("button", { name: "stickies.delete" }));
  expect(remove).toHaveBeenCalledOnce();
  view.unmount();
  expect(unsubscribe).toHaveBeenCalled();
});
it("announces the selected color and preserves the saved color key", () => {
  const update = vi.fn().mockResolvedValue(undefined),
    close = vi.fn();
  render(<ColorPalette handleUpdate={update} selectedColor="pink" onSelect={close} />);
  expect(screen.getByRole("button", { name: "web.pink" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "web.green" }));
  expect(update).toHaveBeenCalledWith({ background_color: "green" });
  expect(close).toHaveBeenCalledOnce();
});
