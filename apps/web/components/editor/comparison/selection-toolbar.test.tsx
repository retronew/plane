import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import type { Value } from "platejs";
import { comparisonPlugins, comparisonEditableComponents } from "./plate-kit";
import { SelectionToolbar } from "./selection-toolbar";
import { setSelectionBlockType } from "./selection-transforms";

// Exercise the real menu/Plate transforms; jsdom cannot measure native ranges.
vi.mock("@platejs/floating", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platejs/floating")>()),
  useFloatingToolbar: () => ({ ref: () => {}, clickOutsideRef: () => {}, props: {}, hidden: false }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const labels = {
  editor: "Editor",
  toolbar: "Formatting",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strikethrough: "Strike",
  code: "Code",
  paragraph: "Paragraph",
  heading1: "Heading 1",
  heading2: "Heading 2",
  blockquote: "Quote",
  undo: "Undo",
  redo: "Redo",
};
afterEach(cleanup);
function setup() {
  const editor = createPlateEditor({
    plugins: comparisonPlugins,
    override: { components: comparisonEditableComponents },
    value: [{ type: "p", children: [{ text: "Selected text" }] }] as Value,
  });
  editor.tf.select({ anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 8 } });
  render(
    <Plate editor={editor}>
      <SelectionToolbar labels={labels} />
      <PlateContent />
    </Plate>
  );
  return editor;
}
it("renders icon-only controls with accessible labels and Propel tooltips", async () => {
  setup();
  for (const label of [
    "Bold",
    "Italic",
    "Underline",
    "Strike",
    "Code",
    "Link",
    "Text color",
    "Background color",
    "Align left",
  ]) {
    const button = screen.getByRole("button", { name: label });
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  }
  expect(screen.getByRole("combobox", { name: "Paragraph" }).textContent).toContain("Paragraph");
  act(() => screen.getByRole("button", { name: "Bold" }).focus());
  expect((await screen.findByRole("tooltip")).textContent).toContain("Bold");
});
it("changes alignment through the icon popup and updates its trigger icon", async () => {
  const editor = setup();
  fireEvent.click(screen.getByRole("button", { name: "Align left" }));
  fireEvent.click(await screen.findByRole("button", { name: "Align center" }));
  expect(editor.children[0].align).toBe("center");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Align center" }).querySelector("svg.lucide-align-center")).not.toBeNull()
  );
});
it("shows a paragraph fallback for mixed blocks and still converts the full selection", async () => {
  const editor = setup();
  act(() => {
    editor.tf.setValue([
      { type: "h1", children: [{ text: "Title" }] },
      { type: "p", children: [{ text: "Body" }] },
    ]);
    editor.tf.select({ anchor: { path: [0, 0], offset: 2 }, focus: { path: [1, 0], offset: 4 } });
  });
  const trigger = screen.getByRole("combobox", { name: "Paragraph" });
  await waitFor(() => expect(trigger.textContent).toContain("Paragraph"));
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("option", { name: "Paragraph" }));
  await waitFor(() => expect(editor.children.map((node) => node.type)).toEqual(["p", "p"]));
  expect(editor.api.string([])).toBe("TitleBody");
});

it("converts lists back to headings without stale list metadata and preserves text", () => {
  const editor = setup();
  act(() => {
    setSelectionBlockType(editor, "todo");
  });
  expect(editor.children[0].listStyleType).toBe("todo");
  act(() => {
    setSelectionBlockType(editor, "h2");
  });
  expect(editor.children[0]).toMatchObject({ type: "h2", children: [{ text: "Selected text" }] });
  expect(editor.children[0].listStyleType).toBeUndefined();
  expect(editor.children[0].checked).toBeUndefined();
});
it("converts code blocks through the official transform in both directions", () => {
  const editor = setup();
  act(() => {
    setSelectionBlockType(editor, "code_block");
  });
  expect(editor.children[0].type).toBe("code_block");
  act(() => {
    setSelectionBlockType(editor, "p");
  });
  expect(editor.children[0]).toMatchObject({ type: "p", children: [{ text: "Selected text" }] });
});
it("applies marks only to the selected text", () => {
  const editor = setup();
  fireEvent.click(screen.getByRole("button", { name: "Bold" }));
  expect(editor.children[0].children).toEqual([{ text: "Selected", bold: true }, { text: " text" }]);
});
it("inserts, edits and removes links through the popup", async () => {
  const editor = setup();
  fireEvent.click(screen.getByRole("button", { name: "Link" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Link URL" }), {
    target: { value: "https://example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() =>
    expect(editor.api.nodes({ at: [], match: { type: "a" } }).next().value?.[0]).toMatchObject({
      url: "https://example.com",
    })
  );
  act(() => editor.tf.select({ anchor: { path: [0, 1, 0], offset: 0 }, focus: { path: [0, 1, 0], offset: 8 } }));
  fireEvent.click(screen.getByRole("button", { name: "Link" }));
  const input = await screen.findByRole("textbox", { name: "Link URL" });
  expect((input as HTMLInputElement).value).toBe("https://example.com");
  fireEvent.change(input, { target: { value: "https://example.org" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() =>
    expect(editor.api.nodes({ at: [], match: { type: "a" } }).next().value?.[0]).toMatchObject({
      url: "https://example.org",
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Link" }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove link" }));
  expect([...editor.api.nodes({ at: [], match: { type: "a" } })]).toHaveLength(0);
});
it("cancels link edits without mutating the document", async () => {
  const editor = setup();
  const before = JSON.stringify(editor.children);
  fireEvent.click(screen.getByRole("button", { name: "Link" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Link URL" }), {
    target: { value: "https://example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  expect(JSON.stringify(editor.children)).toBe(before);
});
it("applies highlight independently from text color", async () => {
  const editor = setup();
  act(() => editor.tf.addMark("color", "#123456"));
  fireEvent.click(screen.getByRole("button", { name: "Background color" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "aria_labels.color_picker.hex_input" }), {
    target: { value: "abcdef" },
  });
  expect(editor.children[0].children[0]).toMatchObject({ color: "#123456", backgroundColor: "#abcdef" });
  fireEvent.click(screen.getByRole("button", { name: "Reset color" }));
  expect(editor.children[0].children[0]).toEqual({ text: "Selected", color: "#123456" });
});
it("applies custom text color and resets it without removing other marks", async () => {
  const editor = setup();
  fireEvent.click(screen.getByRole("button", { name: "Bold" }));
  fireEvent.click(screen.getByRole("button", { name: "Text color" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "aria_labels.color_picker.hex_input" }), {
    target: { value: "123456" },
  });
  expect(editor.children[0].children[0]).toMatchObject({ bold: true, color: "#123456" });
  fireEvent.click(screen.getByRole("button", { name: "Reset color" }));
  expect(editor.children[0].children[0]).toEqual({ text: "Selected", bold: true });
});
