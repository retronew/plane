import { afterEach, describe, expect, it } from "vitest";
import { createPlateEditor } from "platejs/react";
import { YjsEditor, yTextToSlateElement } from "@slate-yjs/core";
import * as Y from "yjs";
import { bindComparisonEditor, replaceSharedValue } from "./collaboration";
import { comparisonPlugins } from "./plate-kit";
import { executeSlashCommand, getSlashMatch } from "./slash-menu";
import type { EditorRefApi } from "../types";

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
  // Plate disables NodeIdPlugin by default in tests; exercise production behavior.
  const editor = bindComparisonEditor(createPlateEditor({ plugins: comparisonPlugins, nodeId: true }), doc);
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
  it("shares stable IDs for splits and inserts from both peers and preserves remote work on local undo", () => {
    const server = serverDocument(),
      a = client(server),
      b = client(server);
    a.editor.tf.select(a.editor.api.start([])!);
    a.editor.tf.insertText("First");
    a.editor.tf.insertBreak();
    a.editor.tf.insertText("Split");
    a.editor.tf.insertNodes({ type: "p", children: [{ text: "Inserted by A" }] }, { at: [2] });
    YjsEditor.flushLocalChanges(a.editor);
    sync(a.doc, b.doc);
    expect(b.editor.children).toEqual(a.editor.children);
    const originalIds = a.editor.children.slice(1).map((node) => node.id);
    expect(originalIds).toEqual([expect.any(String), expect.any(String)]);
    expect(new Set(originalIds).size).toBe(originalIds.length);

    b.editor.undoManager.stopCapturing();
    b.editor.tf.select(b.editor.api.end([2])!);
    b.editor.tf.insertBreak();
    b.editor.tf.insertText("Split by B");
    b.editor.tf.insertNodes({ type: "p", children: [{ text: "Inserted by B" }] }, { at: [4] });
    YjsEditor.flushLocalChanges(b.editor);
    sync(a.doc, b.doc);
    expect(a.editor.children).toEqual(b.editor.children);
    b.editor.tf.undo();
    sync(a.doc, b.doc);
    expect(a.editor.children).toEqual(b.editor.children);
    expect(text(a.editor)).toContain("Inserted by A");
    expect(text(a.editor)).not.toContain("Inserted by B");
    expect(a.editor.children.slice(1).map((node) => node.id)).toEqual(originalIds);
    b.editor.tf.redo();
    sync(a.doc, b.doc);
    expect(a.editor.children).toEqual(b.editor.children);
    expect(text(a.editor)).toContain("Inserted by B");
  });
  it("synchronizes native text deletion and node replacement to another connected peer", () => {
    const server = serverDocument(),
      a = client(server),
      b = client(server);
    replaceSharedValue(a.editor, [
      { type: "p", children: [{ text: "remove keep" }] },
      { type: "p", children: [{ text: "second" }] },
    ]);
    sync(a.doc, b.doc);
    a.editor.tf.select({ anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 7 } });
    a.editor.tf.delete();
    YjsEditor.flushLocalChanges(a.editor);
    sync(a.doc, b.doc);
    expect(text(b.editor)).toBe("keepsecond");
    replaceSharedValue(a.editor, [{ type: "p", children: [{ text: "replacement" }] }]);
    sync(a.doc, b.doc);
    expect(text(b.editor)).toBe("replacement");
    expect(b.editor.children).toHaveLength(1);
  });
  it("persists slash trigger removal and inserted tables across a fresh Yjs client", () => {
    const server = serverDocument(),
      a = client(server);
    replaceSharedValue(a.editor, [{ type: "p", children: [{ text: "/表格Existing content" }] }]);
    a.editor.tf.select({ path: [0, 0], offset: 3 });
    executeSlashCommand(a.editor, getSlashMatch(a.editor)!.range, "table", {} as EditorRefApi);
    YjsEditor.flushLocalChanges(a.editor);
    sync(a.doc, server);
    const reconnected = client(server);
    expect(text(reconnected.editor)).toBe("Existing content");
    expect(reconnected.editor.children.some((node) => node.type === "table")).toBe(true);
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
});
