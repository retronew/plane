import { toggleCodeBlock } from "@platejs/code-block";
import { toggleList } from "@platejs/list";
import type { TElement } from "platejs";
import type { PlateEditor } from "platejs/react";

export function selectionBlockType(node: TElement): string {
  return typeof node.listStyleType === "string"
    ? node.listStyleType
    : node.type === "code_line"
      ? "code_block"
      : node.type;
}

// The registry's setBlockType clears list metadata before assigning a block.
// Code blocks use their plugin transform so code_line children remain valid.
export function setSelectionBlockType(editor: PlateEditor, type: string) {
  const current = editor.api.block()?.[0];
  if (!current || editor.api.blocks({ mode: "lowest" }).every(([node]) => selectionBlockType(node) === type)) return;
  editor.tf.withoutNormalizing(() => {
    if (current.type === "code_line" || current.type === "code_block") toggleCodeBlock(editor);
    if (["disc", "decimal", "todo"].includes(type)) {
      toggleList(editor, { listStyleType: type });
      return;
    }
    for (const [, path] of editor.api.blocks({ mode: "lowest" })) {
      editor.tf.unsetNodes(["listStyleType", "indent", "checked", "listStart", "listRestart"], { at: path });
    }
    if (type === "code_block") toggleCodeBlock(editor);
    else editor.tf.setNodes({ type }, { match: (node) => editor.api.isBlock(node), mode: "lowest" });
  });
}
