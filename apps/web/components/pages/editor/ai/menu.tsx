/** Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only */

import type { EditorRefApi } from "@plane/editor";
import { WritingAssistant } from "@/components/ai/writing-assistant";
import { contextKey } from "@/components/ai/writing";

type Props = {
  editorRef: EditorRefApi | null;
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceSlug: string;
  title: string;
};

export function EditorAIMenu({ editorRef, isOpen, onClose, workspaceSlug, title }: Props) {
  if (!isOpen || !editorRef) return null;
  const getContext = () => ({
    kind: "page" as const,
    title,
    document: editorRef.getDocument().html,
    selection: editorRef.getSelectedText() ?? "",
    position: editorRef.getCurrentCursorPosition(),
  });
  return (
    <div className="rounded-md border border-subtle bg-surface-1 shadow-raised-200">
      <WritingAssistant
        workspaceSlug={workspaceSlug}
        getContext={getContext}
        onClose={onClose}
        onUndo={(context) => editorRef.setEditorValue(context.document, true)}
        onApply={(html, mode, context) => {
          if (contextKey(context) !== contextKey(getContext())) return false;
          if (context.selection) editorRef.insertText(html, mode === "append");
          else editorRef.setEditorValue(mode === "replace" ? html : context.document + html, true);
          return true;
        }}
      />
    </div>
  );
}
