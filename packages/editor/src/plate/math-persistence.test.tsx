import { expect, it } from "vitest";
import { createPlateEditor } from "platejs/react";
import { YjsEditor } from "@slate-yjs/core";
import * as Y from "yjs";
import { comparisonMathPlugins } from "./math";
import { comparisonPlugins } from "./plate-kit";
import { createPlateRef } from "./ref";
import type { EditorAssets } from "./assets";
import { bindComparisonEditor, replaceSharedValue } from "./collaboration";
import { htmlToSlate, slateToHtml } from "../plate-headless";

function editor() {
  return createPlateEditor({ nodeId: true, plugins: [...comparisonPlugins, ...comparisonMathPlugins] });
}

it("executes official math commands through the ref and respects disabled features", () => {
  const instance = editor();
  instance.tf.select(instance.api.start([])!);
  const ref = createPlateRef(
    instance,
    {} as EditorAssets,
    () => {},
    () => null
  );
  ref.api.executeMenuItemCommand({ itemKey: "inline_equation" });
  expect(instance.api.some({ match: { type: "inline_equation" } })).toBe(true);
  ref.api.executeMenuItemCommand({ itemKey: "equation" });
  expect(instance.children.some((node) => node.type === "equation")).toBe(true);
  const disabled = createPlateRef(
    instance,
    {} as EditorAssets,
    () => {},
    () => null,
    () => ["equation"]
  );
  expect(() => disabled.api.executeMenuItemCommand({ itemKey: "equation" })).toThrow("disabled");
  ref.dispose();
  disabled.dispose();
});

it("exports block and inline math through the official Markdown serializer", () => {
  const instance = editor();
  instance.tf.setValue(
    htmlToSlate(
      '<p>Inline <span data-type="inline_equation">x^2</span></p><div data-type="equation">\\frac{1}{2}</div>'
    )
  );
  const ref = createPlateRef(
    instance,
    {} as EditorAssets,
    () => {},
    () => null
  );
  expect(ref.api.getMarkDown()).toBe("Inline $x^2$\n\n$$\n\\frac{1}{2}\n$$\n");
  ref.dispose();
});

it("preserves math text and node IDs through two Yjs peers", () => {
  const first = new Y.Doc();
  const second = new Y.Doc();
  first.get("content", Y.XmlText).applyDelta([{ insert: new Y.XmlText(), attributes: { type: "p" } }]);
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  const a = bindComparisonEditor(editor(), first);
  const b = bindComparisonEditor(editor(), second);
  YjsEditor.connect(a);
  YjsEditor.connect(b);
  try {
    const html =
      '<p>A <span data-type="inline_equation">x &lt; y</span></p><div data-type="equation">\\frac{1}{2}</div>';
    replaceSharedValue(a, htmlToSlate(html));
    YjsEditor.flushLocalChanges(a);
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
    expect(b.children).toEqual(a.children);
    expect(slateToHtml(b.children)).toBe(html);
    b.tf.setNodes({ texExpression: "E=mc^2" }, { at: [1] });
    YjsEditor.flushLocalChanges(b);
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
    expect(a.children).toEqual(b.children);
    expect(slateToHtml(a.children)).toContain("E=mc^2");
  } finally {
    for (const instance of [a, b]) {
      YjsEditor.disconnect(instance);
      instance.undoManager.destroy();
    }
    first.destroy();
    second.destroy();
  }
});
