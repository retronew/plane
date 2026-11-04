import { afterEach, describe, expect, it } from "vitest";
import { createPlateEditor } from "platejs/react";
import { NodeApi, type Value } from "platejs";
import { YjsEditor } from "@slate-yjs/core";
import * as Y from "yjs";
import { createMarkdownInputPlugins } from "./markdown-input";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { bindComparisonEditor } from "./collaboration";

function setup(disabled: () => readonly string[] = () => [], value?: Value) {
  const editor = createPlateEditor({ plugins: createMarkdownInputPlugins(disabled), value });
  editor.tf.select(editor.api.start([])!);
  return editor;
}
function type(editor: ReturnType<typeof setup>, text: string) {
  for (const character of text) editor.tf.insertText(character);
}

describe("official Markdown input rules", () => {
  it("preserves configured code languages when adding input rules", () => {
    const editor = setup();
    expect(editor.getOptions(CodeBlockPlugin).lowlight?.listLanguages()).toEqual(
      expect.arrayContaining(["javascript", "typescript", "python"])
    );
  });
  it.each([1, 2, 3, 4, 5, 6])("converts heading level %i", (level) => {
    const editor = setup();
    type(editor, `${"#".repeat(level)} Title`);
    expect(editor.children[0]).toMatchObject({ type: `h${level}` });
    expect(NodeApi.string(editor.children[0])).toBe("Title");
  });
  it.each([
    ["**text**", "bold"],
    ["__text__", "bold"],
    ["*text*", "italic"],
    ["_text_", "italic"],
    ["~~text~~", "strikethrough"],
    ["`text`", "code"],
  ])("converts %s", (input, mark) => {
    const editor = setup();
    type(editor, input);
    expect(editor.children[0].children).toContainEqual({ text: "text", [mark]: true });
    expect(NodeApi.string(editor.children[0])).toBe("text");
  });
  it.each([
    ["- ", "disc", undefined],
    ["* ", "disc", undefined],
    ["1. ", "decimal", undefined],
    ["1) ", "decimal", undefined],
    ["[] ", "todo", false],
    ["[ ] ", "todo", false],
    ["- [ ] ", "todo", false],
    ["- [x] ", "todo", true],
    ["[x] ", "todo", true],
  ])("converts list prefix %s", (input, listStyleType, checked) => {
    const editor = setup();
    type(editor, `${input}item`);
    expect(editor.children[0]).toMatchObject({ listStyleType, indent: 1 });
    if (checked !== undefined) expect(editor.children[0].checked).toBe(checked);
    expect(NodeApi.string(editor.children[0])).toBe("item");
  });
  it("converts a quote and a fenced code block", () => {
    const quote = setup();
    type(quote, "> quote");
    expect(quote.children[0]).toMatchObject({ type: "blockquote" });
    expect(NodeApi.string(quote.children[0])).toBe("quote");
    const code = setup();
    type(code, "```");
    code.tf.insertBreak();
    expect(code.children[0]).toMatchObject({ type: "code_block" });
    type(code, "**literal**");
    expect(NodeApi.string(code.children[0])).toBe("**literal**");
  });
  it.each([
    ["heading", "# "],
    ["bold", "**text**"],
    ["italic", "*text*"],
    ["strike", "~~text~~"],
    ["code", "`text`"],
    ["blockquote", "> "],
    ["bulletList", "- "],
    ["orderedList", "1. "],
    ["listItem", "- "],
    ["taskList", "[] "],
    ["taskItem", "[x] "],
  ])("respects disabled %s", (disabled, input) => {
    const editor = setup(() => [disabled]);
    type(editor, input);
    expect(editor.children[0]).toMatchObject({ type: "p", children: [{ text: input }] });
    expect(editor.children[0].listStyleType).toBeUndefined();
  });
  it("reads changed capabilities without recreating the editor", () => {
    let disabled: string[] = ["heading"];
    const editor = setup(() => disabled);
    type(editor, "# ");
    expect(editor.children[0].type).toBe("p");
    editor.tf.insertBreak();
    disabled = [];
    type(editor, "# ");
    expect(editor.children[1].type).toBe("h1");
  });
  it("keeps disabled code fences literal on Enter", () => {
    const editor = setup(() => ["codeBlock"]);
    type(editor, "```");
    editor.tf.insertBreak();
    expect(editor.children[0]).toMatchObject({ type: "p", children: [{ text: "```" }] });
    expect(editor.children.some((node) => node.type === "code_block")).toBe(false);
  });
  it("supports undo and redo after formatting", () => {
    const editor = setup();
    type(editor, "# Heading");
    editor.tf.undo();
    expect(editor.children[0].type).toBe("p");
    editor.tf.redo();
    expect(editor.children[0]).toMatchObject({ type: "h1", children: [{ text: "Heading" }] });
  });
  it("does not reinterpret programmatically loaded Markdown", () => {
    const editor = setup(undefined, [{ type: "p", children: [{ text: "# **literal**" }] }]);
    expect(editor.children[0]).toMatchObject({ type: "p", children: [{ text: "# **literal**" }] });
  });
});

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((fn) => fn()));
it("synchronizes formatted nodes to a peer without rerunning input rules", () => {
  const first = new Y.Doc();
  first.get("content", Y.XmlText).applyDelta([{ insert: new Y.XmlText(), attributes: { type: "p" } }]);
  const second = new Y.Doc();
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  const a = bindComparisonEditor(setup(), first);
  const b = bindComparisonEditor(
    setup(() => ["heading"]),
    second
  );
  YjsEditor.connect(a);
  YjsEditor.connect(b);
  cleanup.push(() => {
    for (const editor of [a, b]) {
      YjsEditor.disconnect(editor);
      editor.undoManager.destroy();
    }
    first.destroy();
    second.destroy();
  });
  a.tf.select(a.api.start([])!);
  type(a, "# Shared");
  YjsEditor.flushLocalChanges(a);
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  expect(b.children[0]).toMatchObject({ type: "h1", children: [{ text: "Shared" }] });
  expect(b.children).toEqual(a.children);
});
