import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NodeApi } from "platejs";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import { TogglePlugin, buildToggleIndex } from "@platejs/toggle/react";
import { YjsEditor } from "@slate-yjs/core";
import * as Y from "yjs";
import {
  comparisonPlugins,
  comparisonEditableComponents,
  executeComparisonCommand,
  serializeComparisonHtml,
  deserializeComparisonHtml,
} from "./plate-kit";
import { htmlToSlate, slateToHtml, type SlateValue } from "../plate-headless";
import { legacyJSONToSlate, slateToLegacyJSON } from "./legacy-json";
import { bindComparisonEditor } from "./collaboration";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

const html =
  '<details><summary><strong>Section</strong></summary><p>Body</p><ul style="list-style-type:disc"><li><p>Item</p></li></ul><details><summary>Nested</summary><p>Nested body</p></details></details><p>Outside</p>';
function setup(value: SlateValue = htmlToSlate(html)) {
  return createPlateEditor({
    nodeId: true,
    plugins: comparisonPlugins,
    override: { components: comparisonEditableComponents },
    value,
  });
}

it("round trips nested collapsible sections, marks, lists and following siblings through HTML", async () => {
  const value = htmlToSlate(html);
  expect(value.map((node) => [node.type, node.indent])).toEqual([
    ["toggle", undefined],
    ["p", 1],
    ["p", 2],
    ["toggle", 1],
    ["p", 2],
    ["p", undefined],
  ]);
  const exported = slateToHtml(value);
  expect(exported).toBe(html);
  expect(await serializeComparisonHtml(value)).toBe(html);
  expect(deserializeComparisonHtml(setup(), exported)).toEqual(value);
  expect(slateToHtml(htmlToSlate(exported))).toBe(html);
});

it("preserves toggle content and list indentation through the legacy JSON adapter", () => {
  const value = htmlToSlate(html);
  const restored = legacyJSONToSlate(slateToLegacyJSON(value));
  expect(slateToHtml(restored)).toBe(html);
});

it("preserves nonstandard details as opaque HTML instead of discarding their contents", () => {
  for (const source of [
    "<details><p>Missing summary</p></details>",
    "<details><summary>One</summary><summary>Two</summary><p>Body</p></details>",
  ]) {
    expect(htmlToSlate(source)[0].type).toBe("html_opaque");
    expect(slateToHtml(htmlToSlate(source))).toBe(source);
  }
});

it("creates an open editable toggle and uses official Enter behavior for its body", () => {
  const editor = setup([{ type: "p", children: [{ text: "Title" }] }]);
  editor.tf.select(editor.api.end([0])!);
  executeComparisonCommand(editor, "toggle");
  expect(editor.children[0].type).toBe("toggle");
  expect(editor.getOptions(TogglePlugin).openIds?.has(String(editor.children[0].id))).toBe(true);
  editor.tf.insertBreak();
  editor.tf.insertText("Body");
  expect(editor.children[1]).toMatchObject({ type: "p", indent: 1, children: [{ text: "Body" }] });
  expect(slateToHtml(editor.children)).toBe("<details><summary>Title</summary><p>Body</p></details>");
});

it("keeps table contents intact when inserting a toggle from inside a table", () => {
  const editor = setup(htmlToSlate("<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>"));
  editor.tf.select(editor.api.start([0])!);
  executeComparisonCommand(editor, "toggle");
  expect(editor.children[0].type).toBe("table");
  expect(NodeApi.string(editor.children[0])).toBe("Cell");
  expect(editor.children[1].type).toBe("toggle");
});

it("uses the official visibility index, permits editing title/body, and exposes expanded state", () => {
  const editor = setup();
  render(
    <Plate editor={editor}>
      <PlateContent />
    </Plate>
  );
  const button = screen.getByRole("button", { name: "Section" });
  expect(button.getAttribute("aria-expanded")).toBe("false");
  const body = screen.getByText("Body");
  expect(body.closest('[style*="visibility: hidden"]')).not.toBeNull();
  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Body").closest('[style*="visibility: hidden"]')).toBeNull();
  expect(editor.api.isVoid(editor.children[0])).toBe(false);
  expect(buildToggleIndex(editor.children).get(String(editor.children[4].id))).toEqual([
    editor.children[0].id,
    editor.children[3].id,
  ]);
  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(slateToHtml(editor.children)).toBe(html);
});

it("persists complete toggle content to another Yjs client and a fresh reconnect", () => {
  const aDoc = new Y.Doc();
  const bDoc = new Y.Doc();
  aDoc.get("content", Y.XmlText).applyDelta([{ insert: new Y.XmlText(), attributes: { type: "p" } }]);
  Y.applyUpdate(bDoc, Y.encodeStateAsUpdate(aDoc));
  const a = bindComparisonEditor(setup(), aDoc);
  const b = bindComparisonEditor(setup(), bDoc);
  YjsEditor.connect(a);
  YjsEditor.connect(b);
  try {
    a.tf.select(a.api.start([])!);
    a.tf.insertText("Shared title");
    executeComparisonCommand(a, "toggle");
    a.tf.insertBreak();
    a.tf.insertText("Shared body");
    a.tf.insertBreak();
    a.tf.insertText("Nested title");
    executeComparisonCommand(a, "toggle");
    a.tf.insertBreak();
    a.tf.insertText("Nested body");
    YjsEditor.flushLocalChanges(a);
    Y.applyUpdate(bDoc, Y.encodeStateAsUpdate(aDoc));
    expect(slateToHtml(b.children)).toBe(
      "<details><summary>Shared title</summary><p>Shared body</p><details><summary>Nested title</summary><p>Nested body</p></details></details>"
    );
    expect(b.children).toEqual(a.children);
    const freshDoc = new Y.Doc();
    Y.applyUpdate(freshDoc, Y.encodeStateAsUpdate(aDoc));
    const fresh = bindComparisonEditor(setup(), freshDoc);
    YjsEditor.connect(fresh);
    try {
      expect(fresh.children).toEqual(a.children);
      expect(slateToHtml(fresh.children)).toBe(slateToHtml(a.children));
    } finally {
      YjsEditor.disconnect(fresh);
      fresh.undoManager.destroy();
      freshDoc.destroy();
    }
  } finally {
    for (const editor of [a, b]) {
      YjsEditor.disconnect(editor);
      editor.undoManager.destroy();
    }
    aDoc.destroy();
    bDoc.destroy();
  }
});
