import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorPreferences } from "@/components/editor-preferences";

/** A local caret overlay; native selection and IME remain owned by ProseMirror. */
export function SmoothCursor({ editor }: { editor: Editor | null }) {
  const { smoothCursor } = useEditorPreferences();
  useEffect(() => {
    if (!editor || !smoothCursor) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = editor.view.dom;
    const caret = document.createElement("span");
    caret.hidden = true;
    caret.className = "plane-smooth-caret";
    caret.setAttribute("aria-hidden", "true");
    document.body.appendChild(caret);
    let frame = 0;
    let visible = false;
    const originalCaretColor = root.style.caretColor;
    const update = (animate = true) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const { selection } = editor.state;
        const active =
          editor.isEditable && editor.isFocused && selection.empty && !editor.view.composing && !reducedMotion.matches;
        if (!active) {
          caret.hidden = true;
          root.style.caretColor = originalCaretColor;
          visible = false;
          return;
        }
        const coords = editor.view.coordsAtPos(selection.from);
        const bounds = root.getBoundingClientRect();
        // Restore the native caret outside the editor's visible viewport.
        if (coords.top < Math.max(0, bounds.top) || coords.bottom > Math.min(innerHeight, bounds.bottom)) {
          caret.hidden = true;
          root.style.caretColor = originalCaretColor;
          visible = false;
          return;
        }
        caret.hidden = false;
        caret.style.transition = animate && visible ? "transform 85ms cubic-bezier(.2,.7,.2,1)" : "none";
        caret.style.transform = `translate3d(${coords.left}px, ${coords.top}px, 0)`;
        caret.style.height = `${coords.bottom - coords.top}px`;
        caret.style.backgroundColor = getComputedStyle(root).color;
        root.style.caretColor = "transparent";
        visible = true;
      });
    };
    const animate = () => update();
    const reposition = () => update(false);
    editor.on("transaction", animate).on("focus", reposition).on("blur", reposition);
    root.addEventListener("compositionstart", reposition);
    root.addEventListener("compositionend", reposition);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    reducedMotion.addEventListener("change", reposition);
    reposition();
    return () => {
      cancelAnimationFrame(frame);
      editor.off("transaction", animate).off("focus", reposition).off("blur", reposition);
      root.removeEventListener("compositionstart", reposition);
      root.removeEventListener("compositionend", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      reducedMotion.removeEventListener("change", reposition);
      root.style.caretColor = originalCaretColor;
      caret.remove();
    };
  }, [editor, smoothCursor]);
  return null;
}
