import { Schema, Fragment, Slice } from "@tiptap/pm/model";
import { createUniqueIDPlugin } from "../src/extensions/unique-id/plugin";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it, vi } from "vitest";
import { findParentNodeOfType } from "../src/helpers/common";
import { restorePublicImages } from "../src/helpers/image-helpers";
import { TrackFileRestorationPlugin } from "../src/plugins/file/restore";
import { TrackFileDeletionPlugin } from "../src/plugins/file/delete";
import type { Editor } from "@tiptap/core";

vi.mock("@plane/utils", () => ({
  cn: () => "",
  CORE_EXTENSIONS: { IMAGE: "image", CUSTOM_IMAGE: "imageComponent" },
}));
vi.mock("../src/helpers/assets", () => ({
  CORE_ASSETS_META_DATA_RECORD: { image: (attrs: unknown) => attrs },
}));

const schema = new Schema({
  nodes: {
    doc: { content: "block*" },
    paragraph: { group: "block", content: "inline*" },
    blockquote: { group: "block", content: "block*" },
    text: { group: "inline" },
    image: { group: "block", attrs: { src: {}, id: { default: null } } },
  },
});
const image = (src: string) => schema.nodes.image.create({ src });
const stateWith = (...sources: string[]) =>
  EditorState.create({ schema, doc: schema.nodes.doc.create(null, sources.map(image)) });
function editorWith(deletedImageSet = new Map<string, boolean>()) {
  return {
    storage: { image: { deletedImageSet } },
    commands: { updateAssetsList: vi.fn() },
  } as unknown as Editor;
}

describe("Doctor lookup and async regressions", () => {
  it("regenerates only inserted duplicate IDs and skips collaboration transactions", () => {
    const generateUniqueID = vi.fn(() => "generated");
    const plugin = createUniqueIDPlugin({
      types: ["image"],
      attributeName: "id",
      generateUniqueID,
      filterTransaction: null,
      updateDocument: true,
      provider: undefined,
    });
    const original = schema.nodes.image.create({ src: "a", id: "same" });
    const oldState = EditorState.create({ schema, doc: schema.nodes.doc.create(null, original) });
    const transaction = oldState.tr.insert(oldState.doc.content.size, original);
    const newState = oldState.apply(transaction);
    const result = plugin.spec.appendTransaction?.call(plugin, [transaction], oldState, newState);
    expect(result?.doc.child(0).attrs.id).toBe("same");
    expect(result?.doc.child(1).attrs.id).toBe("generated");
    expect(generateUniqueID).toHaveBeenCalledTimes(1);
    transaction.setMeta("y-sync$", true);
    expect(plugin.spec.appendTransaction?.call(plugin, [transaction], oldState, newState)).toBeUndefined();
  });

  it("clears pasted IDs recursively while preserving text, other attrs and slice openness", () => {
    const plugin = createUniqueIDPlugin({
      types: ["image"],
      attributeName: "id",
      generateUniqueID: () => "new",
      filterTransaction: null,
      updateDocument: true,
      provider: undefined,
    });
    const node = schema.nodes.blockquote.create(null, [
      schema.nodes.paragraph.create(null, schema.text("kept")),
      schema.nodes.image.create({ src: "a", id: "old" }),
    ]);
    const slice = new Slice(Fragment.from(node), 1, 1);
    const transform = plugin.props.transformPasted!;
    expect(transform.call(plugin, slice, {} as never, false)).toBe(slice);
    plugin.props.handleDOMEvents?.paste?.call(plugin, {} as never, {} as never);
    const pasted = transform.call(plugin, slice, {} as never, false);
    expect(pasted.content.firstChild?.child(1).attrs).toEqual({ src: "a", id: null });
    expect(pasted.content.firstChild?.textContent).toBe("kept");
    expect([pasted.openStart, pasted.openEnd]).toEqual([1, 1]);
    expect(transform.call(plugin, slice, {} as never, false)).toBe(slice);
  });
  it("finds the nearest matching ancestor without changing positions", () => {
    const paragraph = schema.nodes.paragraph.create(null, schema.text("hello"));
    const doc = schema.nodes.doc.create(null, schema.nodes.blockquote.create(null, paragraph));
    const selection = TextSelection.create(doc, 3);
    expect(findParentNodeOfType(selection, ["blockquote", "paragraph", "paragraph"])).toEqual({
      node: paragraph,
      pos: 1,
      depth: 2,
    });
    expect(findParentNodeOfType(selection, ["image"])).toBeNull();
  });

  it("restores each public source once in document order and observes failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const restore = vi.fn(async (src: string) => {
        if (src === "https://a") throw new Error("failed");
      });
      const editor = { state: stateWith("https://a", "private-id", "https://a", "http://b") } as Editor;
      await restorePublicImages(editor, restore);
      expect(restore.mock.calls).toEqual([["https://a"], ["http://b"]]);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });

  it("scans restoration once for a transaction batch and marks success only after completion", async () => {
    const oldState = stateWith();
    const newState = stateWith("https://a");
    const editor = editorWith(new Map([["https://a", true]]));
    let complete!: () => void;
    const restore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        })
    );
    const plugin = TrackFileRestorationPlugin(editor, restore);
    const transactions = [oldState.tr.insert(0, image("https://a")), oldState.tr.setMeta("extra", true)];
    expect(plugin.spec.appendTransaction?.call(plugin, transactions, oldState, newState)).toBeNull();
    expect(restore).toHaveBeenCalledExactlyOnceWith("https://a");
    expect(editor.commands.updateAssetsList).toHaveBeenCalledTimes(1);
    expect(editor.storage.image.deletedImageSet.get("https://a")).toBe(true);
    complete();
    await Promise.resolve();
    expect(editor.storage.image.deletedImageSet.get("https://a")).toBe(false);
  });

  it("keeps failed restoration retryable and continues other files", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const oldState = stateWith();
      const newState = stateWith("https://a", "https://b");
      const editor = editorWith(
        new Map([
          ["https://a", true],
          ["https://b", true],
        ])
      );
      const restore = vi.fn(async (src: string) => {
        if (src === "https://a") throw new Error("failed");
      });
      const plugin = TrackFileRestorationPlugin(editor, restore);
      plugin.spec.appendTransaction?.call(plugin, [oldState.tr.insert(0, image("https://a"))], oldState, newState);
      await Promise.resolve();
      expect(restore.mock.calls).toEqual([["https://a"], ["https://b"]]);
      expect(editor.storage.image.deletedImageSet.get("https://a")).toBe(true);
      expect(editor.storage.image.deletedImageSet.get("https://b")).toBe(false);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });

  it("starts deletion in document order and isolates individual failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const oldState = stateWith("https://a", "https://b");
      const newState = stateWith();
      const editor = editorWith();
      const remove = vi.fn(async (src: string) => {
        if (src === "https://a") throw new Error("failed");
      });
      const plugin = TrackFileDeletionPlugin(editor, remove);
      expect(
        plugin.spec.appendTransaction?.call(
          plugin,
          [oldState.tr.delete(0, oldState.doc.content.size)],
          oldState,
          newState
        )
      ).toBeNull();
      await Promise.resolve();
      expect(remove.mock.calls).toEqual([["https://a"], ["https://b"]]);
      expect([...editor.storage.image.deletedImageSet.entries()]).toEqual([
        ["https://a", true],
        ["https://b", true],
      ]);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });
});
