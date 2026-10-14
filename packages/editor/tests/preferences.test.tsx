import { act, render } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { EditorPreferencesContext } from "../src/components/editor-preferences";
import { SmoothCursor } from "../src/components/editors/smooth-cursor";
import { EnterKeyExtension } from "../src/extensions/enter-key";

// The real extension's keyboard handlers, with only the editor view and active menus stubbed.
describe("comment submission shortcuts", () => {
  it("switches without remounting and never submits while composing or selecting a mention", () => {
    const onSubmit = vi.fn();
    let shortcut: "enter" | "mod-enter" = "enter";
    const editor = { storage: { utility: { activeDropbarExtensions: [] as string[] } }, view: { composing: false } };
    const extension = EnterKeyExtension(onSubmit, () => shortcut);
    const shortcuts = extension.config.addKeyboardShortcuts!.call({ editor } as never);
    expect(shortcuts.Enter({} as never)).toBe(true);
    shortcut = "mod-enter";
    expect(shortcuts.Enter({} as never)).toBe(false);
    expect(shortcuts["Mod-Enter"]({} as never)).toBe(true);
    editor.view.composing = true;
    expect(shortcuts["Mod-Enter"]({} as never)).toBe(false);
    editor.view.composing = false;
    editor.storage.utility.activeDropbarExtensions = ["mention"];
    expect(shortcuts["Mod-Enter"]({} as never)).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

const SMOOTH_PREFERENCES = { smoothCursor: true, commentSubmitShortcut: "enter" as const };

describe("smooth cursor", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("restores the native caret for IME, reduced motion and cleanup", () => {
    let reduced = false;
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return reduced;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    let frame: FrameRequestCallback = () => {};
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frame = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const root = document.createElement("div");
    root.getBoundingClientRect = () => ({ top: 0, bottom: 200 }) as DOMRect;
    const listeners: Record<string, () => void> = {};
    const editor = {
      isDestroyed: false,
      isEditable: true,
      isFocused: true,
      state: { selection: { empty: true, from: 1 } },
      view: { dom: root, composing: false, coordsAtPos: () => ({ left: 20, top: 10, bottom: 30 }) },
      on(event: string, callback: () => void) {
        listeners[event] = callback;
        return this;
      },
      off() {
        return this;
      },
    };
    const view = render(
      <EditorPreferencesContext.Provider value={SMOOTH_PREFERENCES}>
        <SmoothCursor editor={editor as never} />
      </EditorPreferencesContext.Provider>
    );
    act(() => frame(0));
    expect(root.style.caretColor).toBe("transparent");
    expect(document.querySelector<HTMLElement>(".plane-smooth-caret")?.hidden).toBe(false);
    editor.view.composing = true;
    act(() => {
      listeners.transaction();
      frame(0);
    });
    expect(root.style.caretColor).toBe("");
    editor.view.composing = false;
    reduced = true;
    act(() => {
      listeners.transaction();
      frame(0);
    });
    expect(root.style.caretColor).toBe("");
    view.unmount();
    expect(document.querySelector(".plane-smooth-caret")).toBeNull();
  });
});
