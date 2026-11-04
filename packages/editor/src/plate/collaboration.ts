import { withYjs, withYHistory, YjsEditor, type YHistoryEditor } from "@slate-yjs/core";
import type { PlateEditor } from "platejs/react";
import { ElementApi, getEditorPlugin, NodeIdPlugin, withNodeId } from "platejs";
import * as Y from "yjs";
export type CollaborationStatus = "connecting" | "synced" | "disconnected" | "error";
export type ComparisonIdentity = { id: string; name: string; avatar?: string | null };
/** Bind after Plate's plugins so Yjs owns history and every local operation. */
export function bindComparisonEditor(editor: PlateEditor, document: Y.Doc): PlateEditor & YHistoryEditor {
  const bound = withYHistory(
    withYjs(editor as PlateEditor & Parameters<typeof withYjs>[0], document.get("content", Y.XmlText), {
      localOrigin: Symbol("local"),
    })
  );
  // Plate's native deletion transforms call tf.apply directly, whereas Slate
  // insertion calls editor.apply. Route both through Yjs so remove_text and
  // other native operations reach remote peers and survive reconnects.
  editor.tf.apply = bound.apply;
  if (editor.plugins[NodeIdPlugin.key]) {
    // Yjs must record IDs after Plate assigns them, otherwise each peer invents
    // a different ID for the same split/insert. Reuse the official transform
    // outside Yjs and let the inner transform retain those already assigned IDs.
    editor.setOptions(NodeIdPlugin, { reuseId: true });
    const normalized = withNodeId(getEditorPlugin(editor, NodeIdPlugin));
    const applyWithIds = normalized.transforms?.apply;
    if (applyWithIds) {
      editor.tf.apply = (operation) => {
        if (operation.type === "split_node" && !operation.properties.type) {
          const entry = editor.api.node(operation.path);
          // Plate can omit the default paragraph type from split properties.
          // Restore it before the official filter decides whether to assign an ID.
          if (entry && ElementApi.isElement(entry[0]))
            return applyWithIds({
              ...operation,
              properties: { ...operation.properties, type: entry[0].type ?? "p" },
            });
        }
        applyWithIds(operation);
      };
      bound.apply = editor.tf.apply as typeof bound.apply;
    }
  }
  editor.tf.undo = bound.undo;
  editor.tf.redo = bound.redo;
  return bound;
}

/** setValue bypasses Slate operations; shared replacements must use real operations. */
export function replaceSharedValue(editor: ReturnType<typeof bindComparisonEditor>, value: PlateEditor["children"]) {
  if (!YjsEditor.connected(editor)) throw new Error("Comparison room is not synchronized");
  editor.undoManager.stopCapturing();
  editor.tf.withoutNormalizing(() => {
    for (let index = editor.children.length - 1; index >= 0; index--) editor.tf.removeNodes({ at: [index] });
    editor.tf.insertNodes(value.length ? value : [{ type: "p", children: [{ text: "" }] }], { at: [0] });
  });
  YjsEditor.flushLocalChanges(editor);
  editor.undoManager.stopCapturing();
}
