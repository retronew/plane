import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import type { EditorRefApi } from "../types";
import { comparisonPlugins } from "./plate-kit";
import { executeSlashCommand, filterSlashItems, getSlashMatch, SlashMenu } from "./slash-menu";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Range.prototype.getBoundingClientRect = () => new DOMRect(10, 20, 0, 20);
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
});
afterEach(cleanup);
const api = { executeMenuItemCommand: vi.fn() } as unknown as EditorRefApi;
function makeEditor(text = "/") {
  const editor = createPlateEditor({ plugins: comparisonPlugins, value: [{ type: "p", children: [{ text }] }] });
  editor.tf.select({ path: [0, 0], offset: text.length });
  return editor;
}
async function setup(text = "/", disabled: string[] = []) {
  const editor = makeEditor(text);
  render(
    <Plate editor={editor}>
      <PlateContent tabIndex={0} />
      <SlashMenu api={api} disabled={disabled} />
    </Plate>
  );
  await act(async () => {
    screen.getByRole("textbox").focus();
    editor.tf.select({ path: [0, 0], offset: text.length });
    editor.tf.insertText(" ");
    editor.tf.deleteBackward("character");
  });
  return editor;
}
it("searches both Chinese and English and respects disabled features", () => {
  expect(filterSlashItems("标题", [])).toHaveLength(6);
  expect(filterSlashItems("table", [])[0].command).toBe("table");
  expect(filterSlashItems("图片", [])[0].command).toBe("image");
  expect(filterSlashItems("标题", ["heading"])).toEqual([]);
  expect(filterSlashItems("task", ["taskList"])).toEqual([]);
});
it("deletes only the trigger query and inserts at the current block", () => {
  const editor = makeEditor("Existing /标题");
  const match = getSlashMatch(editor)!;
  executeSlashCommand(editor, match.range, "heading2", api);
  expect(editor.children[0].type).toBe("h2");
  expect(editor.api.string([])).toBe("Existing ");
});
it("ignores expanded selections, URLs and code blocks", () => {
  const editor = makeEditor("https://example.com");
  expect(getSlashMatch(editor)).toBeNull();
  editor.tf.select({ anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 2 } });
  expect(getSlashMatch(editor)).toBeNull();
});
it("supports arrows and Enter without inserting a newline", async () => {
  const editor = await setup();
  await screen.findByRole("listbox");
  fireEvent.keyDown(document, { key: "ArrowDown" });
  fireEvent.keyDown(document, { key: "Enter" });
  await waitFor(() => expect(editor.children[0].type).toBe("h1"));
  expect(editor.api.string([])).toBe("");
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("searches inline and executes a clicked result", async () => {
  const editor = await setup("/引用");
  const option = await screen.findByRole("option", { name: "web.quote" });
  expect(option.closest("[data-prevent-outside-click]")).not.toBeNull();
  fireEvent.mouseDown(option);
  fireEvent.click(option);
  expect(editor.children[0].type).toBe("blockquote");
  expect(editor.api.string([])).toBe("");
});
it("Escape closes the menu and preserves text", async () => {
  const editor = await setup("/table");
  await screen.findByRole("listbox");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(editor.api.string([])).toBe("/table");
});
it("does not display or intercept Enter when slash commands are disabled", async () => {
  await setup("/", ["slash-commands"]);
  expect(screen.queryByRole("listbox")).toBeNull();
  const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
  document.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
