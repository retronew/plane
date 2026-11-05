import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { DragEvent } from "react";
import type { TElement } from "platejs";
import { createPlateEditor } from "platejs/react";
import { BaseTablePlugin } from "@platejs/table";
import { BaseListPlugin } from "@platejs/list";
import { createImageDropHandler, PlateEditorWithRef } from "./editor";
import { getDragBlocks, isDraggableBlock } from "./draggable-block";
import type { PlateEditorProps } from "./types";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

const value = () => [
  { id: "a", type: "p", children: [{ text: "First" }] },
  { id: "b", type: "p", children: [{ text: "Second" }] },
  { id: "c", type: "p", children: [{ text: "Third" }] },
  {
    id: "t",
    type: "table",
    children: [
      {
        id: "r",
        type: "tr",
        children: [{ id: "d", type: "td", children: [{ id: "x", type: "p", children: [{ text: "Cell" }] }] }],
      },
    ],
  },
];
const editorWith = () => createPlateEditor({ plugins: [BaseTablePlugin, BaseListPlugin], value: value() });

it("drags top-level blocks and blocks inside table cells, never rows or cells", () => {
  const editor = editorWith();
  const table = editor.children[3];
  const row = table.children[0] as TElement;
  const cell = row.children[0] as TElement;
  expect(isDraggableBlock(editor, editor.children[0], [0])).toBe(true);
  expect(isDraggableBlock(editor, table, [3])).toBe(true);
  expect(isDraggableBlock(editor, row, [3, 0])).toBe(false);
  expect(isDraggableBlock(editor, cell, [3, 0, 0])).toBe(false);
  expect(isDraggableBlock(editor, cell.children[0] as TElement, [3, 0, 0, 0])).toBe(true);
});

it("drags the text selection's blocks together when the handle belongs to one of them", () => {
  const editor = editorWith();
  editor.tf.select({ anchor: { path: [0, 0], offset: 1 }, focus: { path: [1, 0], offset: 2 } });
  expect(getDragBlocks(editor, editor.children[1]).map((block) => block.id)).toEqual(["a", "b"]);
  // A handle outside the selection drags only its own block, like the official kit.
  expect(getDragBlocks(editor, editor.children[2]).map((block) => block.id)).toEqual(["c"]);
});

it("leaves non-image drops unhandled so Slate can move dragged text", () => {
  const insert = vi.fn();
  const handler = createImageDropHandler(insert, () => true);
  const drop = (files: File[]) => {
    const event = { dataTransfer: { files }, preventDefault: vi.fn() };
    return { handled: handler(event as unknown as DragEvent<HTMLElement>), event };
  };
  // react-dnd has already called preventDefault on native drops; an explicit false still reaches Slate.
  const text = drop([]);
  expect(text.handled).toBe(false);
  expect(text.event.preventDefault).not.toHaveBeenCalled();
  expect(drop([new File(["x"], "notes.txt", { type: "text/plain" })]).handled).toBe(false);
  const image = drop([new File(["x"], "photo.png", { type: "image/png" })]);
  expect(image.handled).toBe(true);
  expect(insert).toHaveBeenCalledOnce();
  expect(createImageDropHandler(insert, () => false)(image.event as unknown as DragEvent<HTMLElement>)).toBe(false);
});

it("renders exactly one gutter per top-level block, including lists and quotes", () => {
  const props = {
    id: "dnd-test",
    initialValue: "<p>One</p><ul><li>Two</li></ul><blockquote>Three</blockquote>",
    editable: true,
    disabledExtensions: [],
    flaggedExtensions: [],
    fileHandler: {
      assetsUploadStatus: {},
      cancel: vi.fn(),
      checkIfAssetExists: async () => true,
      delete: vi.fn(),
      restore: vi.fn(),
      getAssetSrc: async (id: string) => id,
      getAssetDownloadSrc: async (id: string) => id,
      upload: async () => "asset",
      duplicate: async () => "asset",
      validation: { maxFileSize: 1000 },
    },
    mentionHandler: { renderComponent: () => null },
    getEditorMetaData: () => ({ file_assets: [], user_mentions: [] }),
    extendedEditorProps: {},
  } as unknown as PlateEditorProps;
  const view = render(<PlateEditorWithRef {...props} />);
  const content = view.container.querySelector(".plate-comparison-content")!;
  const blocks = content.querySelectorAll(":scope > .plate-block-draggable");
  expect(blocks.length).toBeGreaterThanOrEqual(3);
  for (const block of blocks) expect(block.querySelectorAll(":scope > [data-plate-drag-handle]")).toHaveLength(1);
});
