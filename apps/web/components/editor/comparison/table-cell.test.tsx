import { describe, expect, it } from "vitest";
import { type TElement } from "platejs";
import { createPlateEditor } from "platejs/react";
import { comparisonPlugins, deserializeComparisonHtml } from "./plate-kit";
import { insertComparisonTableEdge } from "./table-cell";

function createTableEditor() {
  const editor = createPlateEditor({ plugins: comparisonPlugins });
  editor.tf.setValue(
    deserializeComparisonHtml(
      editor,
      "<p>Outside</p><table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>"
    )
  );
  editor.tf.select({ path: [0, 0], offset: 0 });
  return editor;
}

describe("table edge insertion", () => {
  it("inserts after the hovered row while selection is outside the table", () => {
    const editor = createTableEditor();
    const table = editor.children[1] as TElement;
    const cell = (table.children[1] as TElement).children[0] as TElement;
    insertComparisonTableEdge(editor, cell, "rowAfter");
    expect(editor.children[1].children).toHaveLength(3);
    expect(JSON.stringify(editor.children[1].children[1])).toContain('"C"');
    expect(JSON.stringify(editor.children[1].children[2])).not.toContain('"C"');
    expect(editor.selection?.anchor.path.slice(0, 2)).toEqual([1, 2]);
  });

  it("inserts after the hovered column while selection points at another column", () => {
    const editor = createTableEditor();
    editor.tf.select({ path: [1, 1, 0, 0, 0], offset: 0 });
    const table = editor.children[1] as TElement;
    insertComparisonTableEdge(editor, (table.children[0] as TElement).children[1] as TElement, "columnAfter");
    const rows = editor.children[1].children as TElement[];
    expect(rows.map((row) => row.children.length)).toEqual([3, 3]);
    expect(JSON.stringify(rows[0].children[1])).toContain('"B"');
    expect(JSON.stringify(rows[1].children[1])).toContain('"D"');
  });

  it.each(["rowBefore", "columnBefore"] as const)("inserts at the leading %s boundary", (action) => {
    const editor = createTableEditor();
    const table = editor.children[1] as TElement;
    insertComparisonTableEdge(editor, (table.children[0] as TElement).children[0] as TElement, action);
    const rows = editor.children[1].children as TElement[];
    expect(JSON.stringify(action === "rowBefore" ? rows[1].children[0] : rows[0].children[1])).toContain('"A"');
  });
});
