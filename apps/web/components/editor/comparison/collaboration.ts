import { withYjs, withYHistory, YjsEditor } from "@slate-yjs/core";
import { LIVE_URL } from "@plane/constants";
import type { PlateEditor } from "platejs/react";
import * as Y from "yjs";

export type ComparisonIdentity = { id: string; name: string; avatar: string };
export type ComparisonRoom = {
  workspaceSlug: string;
  projectId: string;
  room: string;
  livePort?: string;
  user: ComparisonIdentity;
};
export type CollaborationStatus = "connecting" | "synced" | "disconnected" | "error";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function comparisonRoomName(room: Pick<ComparisonRoom, "workspaceSlug" | "projectId" | "room">) {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(room.workspaceSlug) || !uuid.test(room.projectId) || !uuid.test(room.room)) {
    throw new Error("Invalid comparison room");
  }
  return `plate-comparison:v1:${room.workspaceSlug}:${room.projectId}:${room.room}`;
}

/** Bind after Plate's plugins so Yjs owns history and every local operation. */
export function bindComparisonEditor(editor: PlateEditor, document: Y.Doc) {
  const bound = withYHistory(
    withYjs(editor as PlateEditor & Parameters<typeof withYjs>[0], document.get("content", Y.XmlText), {
      localOrigin: Symbol("local"),
    })
  );
  // Plate's native deletion transforms use tf.apply rather than editor.apply.
  editor.tf.apply = (operation) => bound.apply(operation);
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

export function comparisonLiveUrl(room: ComparisonRoom, origin: string) {
  const url = new URL(`${LIVE_URL.replace(/\/$/, "")}/editor-comparison`, origin);
  const page = new URL(origin);
  if (
    room.livePort &&
    ["localhost", "127.0.0.1"].includes(page.hostname) &&
    /^\d{4,5}$/.test(room.livePort) &&
    Number(room.livePort) <= 65535
  ) {
    url.hostname = page.hostname;
    url.port = room.livePort;
  }
  return url;
}

const assetId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|gif|webp)$/;
export function comparisonRemoteAssets(room: ComparisonRoom, origin: string) {
  const base = comparisonLiveUrl(room, origin);
  const assetUrl = (id?: string) => {
    const url = new URL(`${base.pathname}/assets${id ? `/${encodeURIComponent(id)}` : ""}`, base.origin);
    url.searchParams.set("room", comparisonRoomName(room));
    if (!id) url.searchParams.set("userId", room.user.id);
    return url.toString();
  };
  return {
    upload: async (file: File) => {
      const response = await fetch(assetUrl(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Shared image upload failed");
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("id" in result) ||
        typeof result.id !== "string" ||
        !assetId.test(result.id)
      )
        throw new Error("Invalid shared image response");
      return result.id;
    },
    get: (id: string) => (assetId.test(id) ? assetUrl(id) : undefined),
  };
}
