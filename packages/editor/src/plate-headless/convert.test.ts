// @vitest-environment node
import { describe, expect, it } from "vitest";
import { htmlToSlate, sanitizeHtml, slateToHtml } from "./convert";
import type { SlateElement } from "./types";
import { Doc, XmlText } from "yjs";
import { slateNodesToInsertDelta, yTextToSlateElement } from "./index";

it("preserves imported nodes through the live Y.XmlText content root", () => {
  const value = htmlToSlate(fixture);
  const doc = new Doc();
  const content = doc.get("content", XmlText);
  content.applyDelta(slateNodesToInsertDelta(value));
  expect(slateToHtml(yTextToSlateElement(content).children)).toBe(slateToHtml(value));
  doc.destroy();
});

const fixture = `<h1>Migration &amp; fidelity</h1>
<p style="text-align:center"><strong>B</strong><em>I</em><u>U</u><s>S</s><code>C</code><span data-text-color="#123456" data-background-color="#abcdef">Color</span><a href="https://example.com?q=1&amp;b=2">link</a><mention-component id="Alex" entity_identifier="test-user" entity_name="user_mention"></mention-component></p>
<div data-block-type="callout-component" data-logo-in-use="emoji" data-emoji-unicode="1f600" data-background="#eeeeee"><p>Notice</p></div>
<image-component src="fixture-asset-id" id="image-block" assetid="fixture-asset-id" width="320px" height="auto" alignment="center" aspectratio="1.5" alt="example"></image-component>
<pre><code class="language-typescript">const x = &lt;T&gt;;\n\nnext()</code></pre>
<table><colgroup><col style="width:120px"><col style="width:180px"></colgroup><tbody><tr><th colspan="2" rowspan="2" colwidth="120,180" style="background-color:#ffeeaa;color:#333333"><p>Merged</p></th></tr><tr></tr></tbody></table>
<attachment-component asset_id="file-id" name="report.pdf"></attachment-component><issue-embed-component entity_identifier="issue-id" project_identifier="project-id"></issue-embed-component><external-embed-component url="https://example.com/video" data-provider="test"><iframe src="https://example.com/video"></iframe></external-embed-component>`;

function stableRoundTrips(html: string) {
  const first = slateToHtml(htmlToSlate(html));
  let current = first;
  for (let index = 0; index < 3; index++) current = slateToHtml(htmlToSlate(current));
  expect(current).toBe(first);
  return first;
}
describe("headless HTML conversion (Node, no DOM globals)", () => {
  it("retains business entities, image asset ids and code whitespace", () => {
    expect(typeof globalThis.document).toBe("undefined");
    const nodes = htmlToSlate(fixture);
    expect(nodes.find((node) => node.type === "sandboxImage")).toMatchObject({
      src: "fixture-asset-id",
      id: "image-block",
      assetId: "fixture-asset-id",
      width: "320px",
      alignment: "center",
    });
    expect(nodes.find((node) => node.type === "comparison_callout")).toMatchObject({
      "data-logo-in-use": "emoji",
      "data-background": "#eeeeee",
    });
    expect(nodes.find((node) => node.type === "code_block")).toMatchObject({
      lang: "typescript",
      children: [
        { children: [{ text: "const x = <T>;" }] },
        { children: [{ text: "" }] },
        { children: [{ text: "next()" }] },
      ],
    });
    const html = stableRoundTrips(fixture);
    for (const fragment of [
      'entity_identifier="test-user"',
      'entity_name="user_mention"',
      'src="fixture-asset-id"',
      'asset_id="file-id"',
      'entity_identifier="issue-id"',
      'data-provider="test"',
      'sandbox=""',
      'colspan="2"',
      'rowspan="2"',
      'colwidth="120,180"',
      "width:180px",
      "text-align:center",
    ])
      expect(html).toContain(fragment);
  });
  it("retains nested mixed lists, explicit restarts and task metadata", () => {
    const html =
      '<ol start="3"><li><p>A</p><ul><li>B</li></ul></li><li value="7">C</li><li>D</li></ol><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input checked type="checkbox"><span></span></label><div><p>Done</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Nested</p></div></li></ul></div></li></ul>';
    const nodes = htmlToSlate(html);
    expect(nodes.map((node) => node.indent)).toEqual([1, 2, 1, 1, 1, 2]);
    expect(nodes.map((node) => node.listRestart)).toEqual([3, undefined, 7, undefined, undefined, undefined]);
    expect(nodes.slice(-2).map((node) => node.checked)).toEqual([true, false]);
    const output = stableRoundTrips(html);
    expect(output).toContain('<ol style="list-style-type:decimal" start="7">');
    expect(output).toContain('data-checked="true"');
  });
  it("preserves multi-block list items as opaque rather than collapsing content", () => {
    const html = '<ul><li><p>First</p><p>Second</p><image-component src="asset"></image-component></li></ul>';
    expect(htmlToSlate(html)[0].type).toBe("html_opaque");
    expect(stableRoundTrips(html)).toBe(html);
  });
  it("preserves list content after a nested list without reordering", () => {
    const html = "<ul><li>Before<ul><li>Nested</li></ul>After</li></ul>";
    expect(htmlToSlate(html)[0].type).toBe("html_opaque");
    expect(stableRoundTrips(html)).toBe(html);
  });
  it("retains unknown block/inline HTML and attributes", () => {
    const html =
      '<section data-custom="opaque"><p>Kept</p></section><p>before <custom-token value="42">opaque inline</custom-token> after</p>';
    const nodes = htmlToSlate(html);
    expect(nodes[0].type).toBe("html_opaque");
    expect(nodes[1].children[1]).toMatchObject({
      type: "html_opaque_inline",
      html: '<custom-token value="42">opaque inline</custom-token>',
    });
    expect(stableRoundTrips(html)).toBe(html);
  });
  it("sanitizes both HTML imports and externally supplied opaque nodes", () => {
    const dirty =
      '<section onclick="bad()"><script>bad()</script><a href="java&#x0a;script:bad()">safe text</a><img src="javascript:bad()" onerror="bad()"><iframe src="https://example.com" srcdoc="bad" allow="camera"></iframe><span style="color:red;background-image:url(javascript:bad())">Color</span></section>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toMatch(/onclick|onerror|javascript|srcdoc|<script|background-image/);
    expect(clean).toContain('sandbox=""');
    expect(slateToHtml([{ type: "html_opaque", html: dirty, children: [{ text: "" }] }])).toBe(clean);
  });
  it("uses HTML parsing for malformed HTML and entities", () => {
    const nodes = htmlToSlate("<p>A &copy; &amp; &#x1f600;<p>B<strong>C");
    expect(nodes).toHaveLength(2);
    expect(nodes[0].children[0].text).toBe("A © & 😀");
    expect(stableRoundTrips("<p>A &copy; &amp; &#x1f600;<p>B<strong>C")).toContain("<strong>C</strong>");
  });
  it("does not mutate input or render text as markup", () => {
    const nodes: SlateElement[] = [{ type: "p", children: [{ text: '<script>alert("x")</script>', bold: true }] }];
    const before = JSON.stringify(nodes);
    expect(slateToHtml(nodes)).toContain("&lt;script&gt;");
    expect(JSON.stringify(nodes)).toBe(before);
    expect(() => slateToHtml([{ type: "unknown-node", children: [{ text: "x" }] }])).toThrow(
      "Unsupported Slate node type"
    );
  });
  it("returns an editable paragraph for empty HTML", () => {
    expect(htmlToSlate("")).toEqual([{ type: "p", children: [{ text: "" }] }]);
  });
});
