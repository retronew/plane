import type { EditorRefApi } from "@plane/editor";

/** Open the native picker before creating any comment image node. */
export function pickCommentImage(editor: EditorRefApi | null) {
  if (!editor) return;
  const pos = editor.getCurrentCursorPosition();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/gif,image/webp,image/avif";
  input.hidden = true;
  const cleanup = () => input.remove();
  input.addEventListener("cancel", cleanup, { once: true });
  input.addEventListener(
    "change",
    () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return;
      editor.executeMenuItemCommand({ itemKey: "image", savedSelection: null, file, pos });
    },
    { once: true }
  );
  document.body.appendChild(input);
  input.click();
}
