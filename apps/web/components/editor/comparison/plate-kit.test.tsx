import { describe, expect, it } from "vitest";
import { createSlateEditor, type TElement, type Value } from "platejs";
import { createPlateEditor } from "platejs/react";
import {
  comparisonBasePlugins,
  comparisonPlugins,
  executeComparisonCommand,
  deserializeComparisonHtml,
  serializeComparisonHtml,
} from "./plate-kit";

import { executeComparisonTableAction, getComparisonTableSelection } from "./table-cell";

function createEditor() {
  return createSlateEditor({ plugins: comparisonBasePlugins });
}

describe("comparison HTML conversion", () => {
  it("preserves supported semantic blocks and all marks through an HTML round trip", async () => {
    const editor = createEditor();
    const value = deserializeComparisonHtml(
      editor,
      "<h1>Title</h1><h2>Subtitle</h2><blockquote>Quote</blockquote><p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>deleted</s> <code>code</code></p>"
    );
    const html = await serializeComparisonHtml(value);
    const document = new DOMParser().parseFromString(html, "text/html");
    for (const [tag, text] of [
      ["h1", "Title"],
      ["h2", "Subtitle"],
      ["blockquote", "Quote"],
      ["strong", "bold"],
      ["em", "italic"],
      ["u", "underline"],
      ["s", "deleted"],
      ["code", "code"],
    ]) {
      expect(document.querySelector(tag)?.textContent).toBe(text);
    }
    const restored = deserializeComparisonHtml(editor, html);
    expect(restored.map((node) => node.type)).toEqual(["h1", "h2", "blockquote", "p"]);
    const paragraph = restored[3];
    for (const key of ["bold", "italic", "underline", "strikethrough", "code"]) {
      expect(paragraph.children.some((child) => child[key] === true)).toBe(true);
    }
  });

  it("preserves mention identity and callout metadata", async () => {
    const editor = createEditor();
    const value = deserializeComparisonHtml(
      editor,
      '<p>Owner <mention-component id="Alex" entity_identifier="demo-alex" entity_name="user_mention"></mention-component></p><div data-block-type="callout-component" data-logo-in-use="emoji"><p>Notice</p></div>'
    );
    const html = await serializeComparisonHtml(value);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector("mention-component")?.getAttribute("entity_identifier")).toBe("demo-alex");
    expect(document.querySelector('[data-block-type="callout-component"]')?.textContent).toBe("Notice");
    expect(document.querySelector('[data-block-type="callout-component"]')?.getAttribute("data-logo-in-use")).toBe(
      "emoji"
    );
  });

  it("preserves ordered starts through normalization and groups adjacent items", async () => {
    const editor = createEditor();
    const value = deserializeComparisonHtml(editor, '<ol start="3"><li><p>Three</p></li><li><p>Four</p></li></ol>');
    expect(value[0]).toMatchObject({ listRestart: 3, listStart: 3, indent: 1 });
    editor.tf.setValue(value);
    editor.tf.normalize({ force: true });
    const html = await serializeComparisonHtml(editor.children);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelectorAll("ol")).toHaveLength(1);
    expect(document.querySelector("ol")?.getAttribute("start")).toBe("3");
    expect(document.querySelectorAll("ol > li")).toHaveLength(2);
    expect(deserializeComparisonHtml(editor, html)[0].listRestart).toBe(3);
  });

  it("retains mixed nested lists and sibling order across repeated round trips", async () => {
    const editor = createEditor();
    let value = deserializeComparisonHtml(
      editor,
      '<ul><li><p>Parent</p><ol start="3"><li><p>Child</p><ul><li><p>Deep</p></li></ul></li><li><p>Next child</p></li></ol><ul><li><p>Other child</p></li></ul></li><li><p>Sibling</p></li></ul>'
    );
    for (let pass = 0; pass < 2; pass++) {
      expect(value.map((node) => node.indent)).toEqual([1, 2, 3, 2, 2, 1]);
      expect(value.map((node) => node.children[0].text)).toEqual([
        "Parent",
        "Child",
        "Deep",
        "Next child",
        "Other child",
        "Sibling",
      ]);
      // Each pass must consume the previous export to detect cumulative corruption.
      // eslint-disable-next-line no-await-in-loop
      const html = await serializeComparisonHtml(value);
      const document = new DOMParser().parseFromString(html, "text/html");
      expect(document.querySelectorAll("body > ul")).toHaveLength(1);
      expect(document.querySelectorAll("body > ul > li")).toHaveLength(2);
      expect(document.querySelector("body > ul > li > ol")?.getAttribute("start")).toBe("3");
      expect(document.querySelector("body > ul > li > ol > li > ul > li")?.textContent).toBe("Deep");
      value = deserializeComparisonHtml(editor, html);
    }
  });

  it("exports valid Tiptap task markup including nested tasks in containers", async () => {
    const editor = createEditor();
    let value = deserializeComparisonHtml(
      editor,
      '<div data-block-type="callout-component"><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Done</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Nested</p></div></li></ul></div></li><li data-type="taskItem" data-checked="false"><div><p>Pending</p></div></li></ul></div>'
    );
    for (let pass = 0; pass < 2; pass++) {
      // Each pass must consume the previous export to detect cumulative corruption.
      // eslint-disable-next-line no-await-in-loop
      const html = await serializeComparisonHtml(value);
      expect(html).not.toMatch(/<p[^>]*>\s*<p/);
      const document = new DOMParser().parseFromString(html, "text/html");
      expect(document.querySelectorAll('ul[data-type="taskList"]')).toHaveLength(2);
      expect(document.querySelectorAll('li[data-type="taskItem"]')).toHaveLength(3);
      expect(document.querySelector('li[data-checked="true"] > div > p')?.textContent).toBe("Done");
      expect(document.querySelector('li[data-checked="true"] > ul > li')?.textContent).toBe("Nested");
      expect(document.querySelectorAll("input")).toHaveLength(3);
      expect(document.querySelectorAll("p")).toHaveLength(3);
      value = deserializeComparisonHtml(editor, html);
      expect(value[0].children.map((node) => node.checked)).toEqual([true, false, false]);
    }
  });

  it("keeps ordered restarts and lists separated by paragraphs", async () => {
    const editor = createEditor();
    const value = deserializeComparisonHtml(
      editor,
      '<ol start="3"><li>A</li><li value="7">B</li><li>C</li></ol><p>Break</p><ul><li>D</li><li>E</li></ul>'
    );
    const document = new DOMParser().parseFromString(await serializeComparisonHtml(value), "text/html");
    expect(Array.from(document.querySelectorAll("ol"), (list) => list.start)).toEqual([3, 7]);
    expect(document.querySelectorAll("ol")[1].children).toHaveLength(2);
    expect(document.querySelectorAll("body > ul > li")).toHaveLength(2);
    expect(document.querySelector("body > p")?.textContent).toBe("Break");
  });

  it("snapshots each export before asynchronous serialization", async () => {
    const value: Value = [{ type: "p", children: [{ text: "before" }] }];
    const first = serializeComparisonHtml(value);
    value[0].children[0] = { text: "after", bold: true };
    const second = serializeComparisonHtml(value);
    expect(await first).toContain("before");
    expect(await first).not.toContain("after");
    expect(new DOMParser().parseFromString(await second, "text/html").querySelector("strong")?.textContent).toBe(
      "after"
    );
  });

  it("imports an empty document as an editable paragraph", () => {
    expect(deserializeComparisonHtml(createEditor(), "")).toMatchObject([{ type: "p", children: [{ text: "" }] }]);
  });

  it("escapes HTML-looking text when exporting", async () => {
    const html = await serializeComparisonHtml([{ type: "p", children: [{ text: '<script>alert("x")</script>' }] }]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

it("round trips lists, tasks, links, table, code, alignment and colors", async () => {
  const editor = createEditor();
  const value = deserializeComparisonHtml(
    editor,
    '<h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6><ul><li>Bullet</li></ul><ol><li>Number</li></ol><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li></ul><p style="text-align:center"><a href="https://example.com">Link</a><span style="color:#dc2626;background-color:#ca8a04">Color</span></p><table><tbody><tr><th>A</th><td>B</td></tr></tbody></table><pre><code>line one\nline two</code></pre><hr>'
  );
  const html = await serializeComparisonHtml(value);
  const restored = deserializeComparisonHtml(editor, html);
  expect(restored.filter((node) => node.type.startsWith("h")).map((node) => node.type)).toEqual([
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
  ]);
  expect(restored.find((node) => node.listStyleType === "disc")).toBeDefined();
  expect(restored.find((node) => node.listStyleType === "decimal")).toBeDefined();
  expect(restored.find((node) => node.listStyleType === "todo")?.checked).toBe(true);
  expect(restored.find((node) => node.type === "table")?.children).toHaveLength(1);
  expect(restored.find((node) => node.type === "code_block")?.children).toHaveLength(2);
  expect(restored.find((node) => node.align === "center")).toBeDefined();
  expect(JSON.stringify(restored)).toContain("https://example.com");
  expect(JSON.stringify(restored)).toContain("rgb(220, 38, 38)");
});

it("executes actual list, code and table transforms", () => {
  const editor = createEditor();
  editor.tf.setValue([{ type: "p", children: [{ text: "Text" }] }]);
  editor.tf.select({ path: [0, 0], offset: 0 });
  executeComparisonCommand(editor, "todoList");
  expect(editor.children[0].listStyleType).toBe("todo");
  executeComparisonCommand(editor, "todoList");
  executeComparisonCommand(editor, "codeBlock");
  expect(editor.children[0].type).toBe("code_block");
  executeComparisonCommand(editor, "codeBlock");
  executeComparisonCommand(editor, "table");
  const table = editor.children.find((node) => node.type === "table");
  expect(table?.children).toHaveLength(3);
});

describe("contextual table operations", () => {
  function tableEditor() {
    const editor = createPlateEditor({ plugins: comparisonPlugins });
    editor.tf.setValue(
      deserializeComparisonHtml(
        editor,
        "<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>"
      )
    );
    editor.tf.select({ path: [0, 0, 0, 0, 0], offset: 0 });
    return editor;
  }

  it("inserts before the current row and column, then deletes the inserted structures", () => {
    const editor = tableEditor();
    executeComparisonTableAction(editor, "rowBefore");
    expect(editor.children[0].children).toHaveLength(3);
    expect(JSON.stringify(editor.children[0].children[1])).toContain('"A"');
    executeComparisonTableAction(editor, "deleteRow");
    expect(editor.children[0].children).toHaveLength(2);
    editor.tf.select({ path: [0, 0, 0, 0, 0], offset: 0 });
    executeComparisonTableAction(editor, "columnBefore");
    expect(editor.children[0].children[0].children).toHaveLength(3);
    expect(JSON.stringify((editor.children[0].children[0] as TElement).children[1])).toContain('"A"');
    executeComparisonTableAction(editor, "deleteColumn");
    expect(editor.children[0].children[0].children).toHaveLength(2);
  });

  it("merges a rectangular selection and splits without losing cell contents", async () => {
    const editor = tableEditor();
    editor.tf.select({ anchor: { path: [0, 0, 0, 0, 0], offset: 0 }, focus: { path: [0, 1, 1, 0, 0], offset: 1 } });
    expect(getComparisonTableSelection(editor).canMerge).toBe(true);
    executeComparisonTableAction(editor, "merge");
    expect((editor.children[0].children[0] as TElement).children[0]).toMatchObject({ colSpan: 2, rowSpan: 2 });
    const html = await serializeComparisonHtml(editor.children);
    expect(html).toContain('colspan="2"');
    expect(html).toContain('rowspan="2"');
    expect(getComparisonTableSelection(editor).canSplit).toBe(true);
    executeComparisonTableAction(editor, "split");
    expect(editor.children[0].children.map((row) => (row as TElement).children.length)).toEqual([2, 2]);
    for (const text of ["A", "B", "C", "D"]) expect(JSON.stringify(editor.children)).toContain(`"${text}"`);
  });

  it("ignores merge and split outside a table", () => {
    const editor = createEditor();
    editor.tf.setValue([{ type: "p", children: [{ text: "Keep" }] }]);
    editor.tf.select({ path: [0, 0], offset: 0 });
    expect(() => executeComparisonTableAction(editor, "merge")).not.toThrow();
    expect(() => executeComparisonTableAction(editor, "split")).not.toThrow();
    expect(editor.children[0].children[0].text).toBe("Keep");
  });
});

it("preserves code language, blank lines and escaped text across legacy HTML round trips", async () => {
  const editor = createEditor();
  let value = deserializeComparisonHtml(
    editor,
    '<pre><code class="language-typescript">const x = &lt;T&gt;;\n\nnext()</code></pre>'
  );
  for (let pass = 0; pass < 2; pass++) {
    expect(value[0].lang).toBe("typescript");
    // Each round consumes the previous export to catch accumulated corruption.
    // eslint-disable-next-line no-await-in-loop
    const html = await serializeComparisonHtml(value);
    const document = new DOMParser().parseFromString(html, "text/html");
    const code = document.querySelector("pre > code.language-typescript");
    expect(code?.textContent).toBe("const x = <T>;\n\nnext()");
    expect(code?.children).toHaveLength(0);
    value = deserializeComparisonHtml(editor, html);
  }
});
