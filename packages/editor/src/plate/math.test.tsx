import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createSlateEditor, type TEquationElement } from "platejs";
import { BaseEquationPlugin, BaseInlineEquationPlugin } from "@platejs/math";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import { comparisonMathPlugins } from "./math";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

function mount(expression = "x^2", readOnly = false, inline = false) {
  const equation: TEquationElement = {
    type: inline ? "inline_equation" : "equation",
    texExpression: expression,
    children: [{ text: "" }],
  };
  const editor = createPlateEditor({
    plugins: comparisonMathPlugins,
    value: inline ? [{ type: "p", children: [{ text: "Before " }, equation, { text: " after" }] }] : [equation],
  });
  const view = render(
    <Plate editor={editor} readOnly={readOnly}>
      <PlateContent />
    </Plate>
  );
  return { ...view, editor };
}

it("renders block math with KaTeX and accessible MathML", () => {
  const { container } = mount();
  expect(container.querySelector(".katex-display math")).toBeTruthy();
  expect(container.querySelector("annotation")?.textContent).toBe("x^2");
});

it("edits LaTeX through the official input hook and updates the preview", async () => {
  const { editor, container } = mount();
  fireEvent.click(screen.getByRole("button", { name: "edit LaTeX" }));
  const input = await screen.findByRole("textbox", { name: "LaTeX" });
  fireEvent.change(input, { target: { value: "\\frac{a}{b}" } });
  await waitFor(() => expect((editor.children[0] as TEquationElement).texExpression).toBe("\\frac{a}{b}"));
  expect(container.querySelector("annotation")?.textContent).toBe("\\frac{a}{b}");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "LaTeX" })).toBeNull());
});

it("renders inline math in read-only content without editing controls", () => {
  const { container } = mount("a+b", true, true);
  expect(container.querySelector(".katex math")).toBeTruthy();
  expect(container.querySelector(".katex-display")).toBeNull();
  expect(screen.queryByRole("button", { name: "edit LaTeX" })).toBeNull();
  expect(container.textContent).toContain("Before ");
  expect(container.textContent).toContain(" after");
});

it("renders invalid LaTeX without crashing", () => {
  const { container } = mount("\\frac{", true);
  expect(container.querySelector(".katex-error")).toBeTruthy();
});

it("does not trust LaTeX HTML or link commands", () => {
  const { container } = mount("\\href{https://example.com}{unsafe}", true);
  expect(container.querySelector(".plane-equation-render a")).toBeNull();
});

it("supports official headless node normalization and HTML deserialization", () => {
  const editor = createSlateEditor({ plugins: [BaseEquationPlugin, BaseInlineEquationPlugin] });
  const nodes = editor.api.html.deserialize({
    element:
      '<div class="slate-equation" data-slate-tex-expression="x^2"></div><p><span class="slate-inline_equation" data-slate-tex-expression="a+b"></span></p>',
  });
  expect(nodes[0]).toMatchObject({ type: "equation", texExpression: "x^2", children: [{ text: "" }] });
  expect(nodes[1].children).toContainEqual({ type: "inline_equation", texExpression: "a+b", children: [{ text: "" }] });
});
