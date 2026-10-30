import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlateEditor } from "platejs/react";
import { YjsEditor, yTextToSlateElement } from "@slate-yjs/core";
import * as Y from "yjs";
import {
  bindComparisonEditor,
  comparisonRoomName,
  replaceSharedValue,
  comparisonRemoteAssets,
  comparisonLiveUrl,
} from "./collaboration";

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((fn) => fn()));
function serverDocument() {
  const doc = new Y.Doc();
  doc.get("content", Y.XmlText).applyDelta([{ insert: new Y.XmlText(), attributes: { type: "p" } }]);
  doc.getMap("meta").set("initialized", true);
  cleanup.push(() => doc.destroy());
  return doc;
}
function client(server: Y.Doc) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(server));
  const editor = bindComparisonEditor(createPlateEditor(), doc);
  YjsEditor.connect(editor);
  cleanup.push(() => {
    YjsEditor.disconnect(editor);
    editor.undoManager.destroy();
    doc.destroy();
  });
  return { doc, editor };
}
function sync(a: Y.Doc, b: Y.Doc) {
  const left = Y.encodeStateAsUpdate(a),
    right = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(a, right);
  Y.applyUpdate(b, left);
}
function text(editor: ReturnType<typeof client>["editor"]) {
  return editor.api.string([]);
}

describe("comparison collaboration", () => {
  it("persists native Plate deletion to a second document and reconnect", () => {
    const server = serverDocument(),
      a = client(server),
      b = client(server);
    replaceSharedValue(a.editor, [{ type: "p", children: [{ text: "remove keep" }] }]);
    sync(a.doc, b.doc);
    a.editor.tf.select({ anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 7 } });
    a.editor.tf.delete();
    YjsEditor.flushLocalChanges(a.editor);
    sync(a.doc, b.doc);
    expect(text(b.editor)).toBe("keep");
    expect(text(client(a.doc).editor)).toBe("keep");
  });
  it("accepts the server's canonical empty paragraph without duplicate initialization", () => {
    const server = serverDocument(),
      a = client(server),
      b = client(server);
    sync(a.doc, b.doc);
    expect(a.editor.children).toHaveLength(1);
    expect(yTextToSlateElement(a.doc.get("content", Y.XmlText)).children).toHaveLength(1);
    expect(text(a.editor)).toBe("");
  });
  it("merges concurrent edits from two independent Plate instances", () => {
    const server = serverDocument(),
      a = client(server),
      b = client(server);
    a.editor.tf.insertText("Alice", { at: { path: [0, 0], offset: 0 } });
    b.editor.tf.insertText("Bob", { at: { path: [0, 0], offset: 0 } });
    YjsEditor.flushLocalChanges(a.editor);
    YjsEditor.flushLocalChanges(b.editor);
    sync(a.doc, b.doc);
    expect(text(a.editor)).toBe(text(b.editor));
    expect(text(a.editor)).toContain("Alice");
    expect(text(a.editor)).toContain("Bob");
  });
  it("undoes and redoes only the local user's edit", () => {
    const server = serverDocument(),
      a = client(server),
      b = client(server);
    a.editor.tf.insertText("Alice", { at: { path: [0, 0], offset: 0 } });
    YjsEditor.flushLocalChanges(a.editor);
    sync(a.doc, b.doc);
    b.editor.tf.insertText("Bob", { at: { path: [0, 0], offset: 5 } });
    YjsEditor.flushLocalChanges(b.editor);
    sync(a.doc, b.doc);
    a.editor.tf.undo();
    sync(a.doc, b.doc);
    expect(text(a.editor)).toBe("Bob");
    expect(text(b.editor)).toBe("Bob");
    a.editor.tf.redo();
    sync(a.doc, b.doc);
    expect(text(a.editor)).toBe("AliceBob");
    expect(text(b.editor)).toBe("AliceBob");
  });
  it("persists an explicit clear across a fresh client reconnect without restoring samples", () => {
    const server = serverDocument(),
      a = client(server);
    replaceSharedValue(a.editor, [{ type: "p", children: [{ text: "sample" }] }]);
    sync(a.doc, server);
    replaceSharedValue(a.editor, [{ type: "p", children: [{ text: "" }] }]);
    sync(a.doc, server);
    const reconnected = client(server);
    expect(text(reconnected.editor)).toBe("");
    expect(reconnected.doc.getMap("meta").get("initialized")).toBe(true);
  });
  it("resynchronizes independent edits after a transport interruption", () => {
    const server = serverDocument(),
      a = client(server),
      b = client(server);
    replaceSharedValue(a.editor, [{ type: "p", children: [{ text: "base" }] }]);
    sync(a.doc, b.doc);
    a.editor.tf.insertText("A", { at: { path: [0, 0], offset: 4 } });
    b.editor.tf.insertText("B", { at: { path: [0, 0], offset: 0 } });
    YjsEditor.flushLocalChanges(a.editor);
    YjsEditor.flushLocalChanges(b.editor);
    sync(a.doc, b.doc);
    expect(text(a.editor)).toBe("BbaseA");
    expect(text(b.editor)).toBe("BbaseA");
  });
  it("isolates room, project and workspace names and separate documents", () => {
    const base = {
      workspaceSlug: "test",
      projectId: "11111111-1111-1111-1111-111111111111",
      room: "22222222-2222-2222-2222-222222222222",
    };
    expect(
      new Set(
        [
          base,
          { ...base, workspaceSlug: "other" },
          { ...base, projectId: base.room },
          { ...base, room: base.projectId },
        ].map(comparisonRoomName)
      ).size
    ).toBe(4);
    expect(() => comparisonRoomName({ ...base, room: "../production" })).toThrow();
    const a = client(serverDocument()),
      b = client(serverDocument());
    replaceSharedValue(a.editor, [{ type: "p", children: [{ text: "private" }] }]);
    expect(text(b.editor)).toBe("");
  });
});

const assetRoom = {
  workspaceSlug: "test",
  projectId: "11111111-1111-1111-1111-111111111111",
  room: "22222222-2222-2222-2222-222222222222",
  livePort: "3101",
  user: { id: "me", name: "Me", avatar: "" },
};
it("uses authenticated room uploads and cross-user image URLs with safe image IDs", async () => {
  const id = "33333333-3333-3333-3333-333333333333.jpg";
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ id }), { status: 201 }));
  try {
    const remote = comparisonRemoteAssets(assetRoom, "http://localhost:3000");
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    expect(await remote.upload(file)).toBe(id);
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(String(url)).port).toBe("3101");
    expect(new URL(String(url)).searchParams.get("userId")).toBe("me");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      body: file,
      headers: { "Content-Type": "image/jpeg" },
    });
    const imageUrl = new URL(remote.get(id)!);
    expect(imageUrl.searchParams.get("userId")).toBeNull();
    expect(imageUrl.searchParams.get("room")).toBe(comparisonRoomName(assetRoom));
    expect(remote.get("../private.png")).toBeUndefined();
    expect(remote.get("33333333-3333-3333-3333-333333333333.svg")).toBeUndefined();
    fetcher.mockResolvedValueOnce(new Response("denied", { status: 403 }));
    await expect(remote.upload(file)).rejects.toThrow("upload failed");
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ id: "../../secret" })));
    await expect(remote.upload(file)).rejects.toThrow("Invalid shared image response");
  } finally {
    fetcher.mockRestore();
  }
});
it("matches server room validation and restricts port overrides to the local machine", () => {
  for (const workspaceSlug of ["UPPER", "under_score", "-leading", "a".repeat(101)])
    expect(() => comparisonRoomName({ ...assetRoom, workspaceSlug })).toThrow();
  expect(comparisonLiveUrl(assetRoom, "http://localhost:3000").port).toBe("3101");
  expect(comparisonLiveUrl(assetRoom, "https://plane.example").port).not.toBe("3101");
  expect(comparisonLiveUrl({ ...assetRoom, livePort: "evil.example" }, "http://localhost:3000").hostname).not.toBe(
    "evil.example"
  );
});
