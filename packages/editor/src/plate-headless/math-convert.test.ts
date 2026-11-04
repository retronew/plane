import { expect, it } from "vitest";
import { htmlToSlate, slateToHtml } from "./convert";
import { legacyJSONToSlate, slateToLegacyJSON } from "../plate/legacy-json";

it("round trips block and inline LaTeX as text without loading browser math plugins", () => {
  const html =
    '<p>Before <span data-type="inline_equation">x &lt; y &amp; z</span> after</p><div data-type="equation">\\frac{a}{b}\n+ c</div>';
  const nodes = htmlToSlate(html);
  expect(nodes[0].children[1]).toMatchObject({
    type: "inline_equation",
    texExpression: "x < y & z",
    children: [{ text: "" }],
  });
  expect(nodes[1]).toMatchObject({ type: "equation", texExpression: "\\frac{a}{b}\n+ c", children: [{ text: "" }] });
  expect(slateToHtml(nodes)).toBe(html);
  expect(slateToHtml(legacyJSONToSlate(slateToLegacyJSON(nodes)))).toBe(html);
});

it.each([
  '<ul style="list-style-type:disc"><li><div data-type="equation">x^2</div></li></ul>',
  '<ol style="list-style-type:decimal" start="1"><li><div data-type="equation">x^2</div></li></ol>',
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><div data-type="equation">x^2</div></div></li></ul>',
])("preserves a block equation in a list across HTML and legacy JSON: %s", (html) => {
  const value = htmlToSlate(html);
  expect(value[0]).toMatchObject({ type: "equation", texExpression: "x^2", indent: 1 });
  expect(slateToHtml(value)).toBe(html);
  expect(slateToHtml(legacyJSONToSlate(slateToLegacyJSON(value)))).toBe(html);
});

it("keeps a list opaque when an empty equation follows a nested list", () => {
  const html = '<ul><li><p>Item</p><ul><li>Nested</li></ul><div data-type="equation"></div></li></ul>';
  expect(htmlToSlate(html)[0].type).toBe("html_opaque");
  expect(slateToHtml(htmlToSlate(html))).toBe(html);
});

it.each([
  '<p><a href="https://example.com"><span data-type="inline_equation">x^2</span></a></p>',
  '<p><a href="https://example.com"><strong>Before </strong><span data-type="inline_equation">x &lt; y</span> after</a></p>',
])("preserves linked inline equations and surrounding marks in legacy JSON: %s", (html) => {
  const value = htmlToSlate(html);
  const restored = legacyJSONToSlate(slateToLegacyJSON(value));
  expect(restored[0].children[0]).toMatchObject({
    type: "a",
    url: "https://example.com",
    children: expect.arrayContaining([expect.objectContaining({ type: "inline_equation" })]),
  });
  expect(slateToHtml(restored)).toBe(html);
});

it("keeps plain text links in the existing legacy link-mark format", () => {
  const value = htmlToSlate('<p><a href="https://example.com">Link</a></p>');
  expect(slateToLegacyJSON(value).content?.[0].content?.[0]).toEqual({
    type: "text",
    text: "Link",
    marks: [{ type: "link", attrs: { href: "https://example.com" } }],
  });
});

it("escapes externally supplied LaTeX and does not turn it into executable HTML", () => {
  const texExpression = '<img src=x onerror="alert(1)"><script>alert(2)</script>&\\href{javascript:alert(3)}{x}';
  const html = slateToHtml([{ type: "equation", texExpression, children: [{ text: "" }] }]);
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<script");
  expect(html).toContain("&lt;img");
  expect(htmlToSlate(html)[0].texExpression).toBe(texExpression);
  const imported = htmlToSlate('<div data-type="equation" onclick="alert(1)">safe<script>alert(2)</script></div>');
  expect(slateToHtml(imported)).toBe('<div data-type="equation">safe</div>');
});

it("keeps equations inside collapsible sections across HTML and legacy JSON", () => {
  const html =
    '<details><summary>Math <span data-type="inline_equation">x^2</span></summary><div data-type="equation">E=mc^2</div></details>';
  const value = htmlToSlate(html);
  expect(value[1]).toMatchObject({ type: "equation", indent: 1 });
  expect(slateToHtml(value)).toBe(html);
  expect(slateToHtml(legacyJSONToSlate(slateToLegacyJSON(value)))).toBe(html);
});
