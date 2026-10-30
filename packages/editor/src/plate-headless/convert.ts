import { parseFragment, serializeOuter, type DefaultTreeAdapterMap } from "parse5";
import type { SlateElement, SlateNode, SlateText, SlateValue } from "./types";

type HtmlNode = DefaultTreeAdapterMap["childNode"];
type HtmlElement = DefaultTreeAdapterMap["element"];
type Attributes = Record<string, string>;
const empty = (): SlateText[] => [{ text: "" }];
const element = (node: HtmlNode): node is HtmlElement => "tagName" in node;
const isBlock = (tag: string) =>
  /^(p|h[1-6]|blockquote|pre|ul|ol|table|hr|div|section|article|figure|image-component|img|.*-embed-component|attachment-component)$/.test(
    tag
  );
const blocked = new Set([
  "script",
  "style",
  "object",
  "embed",
  "base",
  "meta",
  "link",
  "form",
  "svg",
  "math",
  "template",
]);
const voidTags = new Set(["area", "br", "col", "hr", "img", "input", "source", "wbr"]);
const safeName = /^[a-zA-Z_][a-zA-Z0-9_.:-]*$/;
const urlAttributes = new Set(["href", "src", "url", "action", "poster", "xlink:href", "data-emoji-url"]);
const escape = (text: unknown) =>
  String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function safeUrl(value: string) {
  // URL parsers ignore controls; remove them before checking the scheme.
  // eslint-disable-next-line no-control-regex
  const compact = value.replace(/[\u0000- \u007f-\u009f]/g, "");
  return !/^[a-z][a-z0-9+.-]*:/i.test(compact) || /^(https?:|mailto:|tel:)/i.test(compact);
}
function safeStyle(value: string) {
  const declarations = value.split(";").filter((declaration) => {
    const colon = declaration.indexOf(":");
    const key = declaration.slice(0, colon).trim().toLowerCase();
    const val = declaration.slice(colon + 1).trim();
    return (
      /^(color|background-color|text-align|vertical-align|width|height|min-width|max-width|font-weight|font-style|text-decoration|white-space|list-style-type|margin-left)$/.test(
        key
      ) &&
      /^[#(),.%\w\s-]+$/.test(val) &&
      !/url|expression|behavior|binding/i.test(val)
    );
  });
  return Object.entries(
    Object.fromEntries(
      declarations.map((part) => {
        const colon = part.indexOf(":");
        return [part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim()];
      })
    )
  )
    .map(([key, val]) => `${key}:${val}`)
    .join(";");
}
function cleanAttributes(attributes: Attributes): Attributes {
  const result: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    const name = key.toLowerCase();
    if (
      !safeName.test(name) ||
      name.startsWith("on") ||
      ["srcdoc", "srcset", "is", "formaction", "xmlns"].includes(name)
    )
      continue;
    if (urlAttributes.has(name) && !safeUrl(value)) continue;
    if (name === "style") {
      const style = safeStyle(value);
      if (style) result[name] = style;
    } else result[name] = value;
  }
  return result;
}
function attrs(node: HtmlElement): Attributes {
  return Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
}
function cleanTree(parent: { childNodes: HtmlNode[] }) {
  parent.childNodes = parent.childNodes.filter(
    (node) => node.nodeName !== "#comment" && !(element(node) && blocked.has(node.tagName))
  );
  for (const node of parent.childNodes)
    if (element(node)) {
      const attributes = cleanAttributes(attrs(node));
      if (node.tagName === "iframe") {
        attributes.sandbox = "";
        attributes.referrerpolicy = "no-referrer";
      }
      node.attrs = Object.entries(attributes).map(([name, value]) => ({ name, value }));
      cleanTree(node);
    }
}
/** Safe subset of HTML. Active content, unsafe URLs and executable CSS are removed. */
export function sanitizeHtml(html: string): string {
  const fragment = parseFragment(html);
  cleanTree(fragment);
  return fragment.childNodes.map((node) => serializeOuter(node)).join("");
}
function styleMap(a: Attributes): Attributes {
  return Object.fromEntries(
    (a.style ?? "")
      .split(";")
      .map((part) => {
        const i = part.indexOf(":");
        return [part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim()];
      })
      .filter(([key]) => key)
  );
}
function textOf(node: HtmlNode): string {
  if ("value" in node) return node.value;
  return element(node) ? node.childNodes.map(textOf).join("") : "";
}
function opaque(node: HtmlNode, isInline: boolean): SlateElement {
  return { type: isInline ? "html_opaque_inline" : "html_opaque", html: serializeOuter(node), children: empty() };
}
function block(
  type: string,
  children: SlateNode[],
  attributes: Attributes = {},
  extra: Record<string, unknown> = {}
): SlateElement {
  return {
    type,
    ...(Object.keys(attributes).length ? { htmlAttributes: attributes } : {}),
    ...extra,
    children: children.length ? children : empty(),
  };
}
function inline(nodes: HtmlNode[], inherited: Record<string, unknown> = {}): SlateNode[] {
  return nodes.flatMap((node): SlateNode[] => {
    if (!element(node)) return "value" in node ? [{ ...inherited, text: node.value }] : [];
    const a = attrs(node),
      style = styleMap(a),
      tag = node.tagName;
    if (tag === "br") return [{ ...inherited, text: "\n" }];
    if (tag === "mention-component") return [block("comparison_mention", empty(), a, a)];
    if (tag === "a") return [block("a", inline(node.childNodes, inherited), a, { url: a.href ?? "" })];
    const marks: Record<string, unknown> = { ...inherited };
    const mark = (
      {
        strong: "bold",
        b: "bold",
        em: "italic",
        i: "italic",
        u: "underline",
        s: "strikethrough",
        strike: "strikethrough",
        del: "strikethrough",
        code: "code",
        sup: "superscript",
        sub: "subscript",
      } as Record<string, string>
    )[tag];
    if (mark) marks[mark] = true;
    if (style.color || a["data-text-color"]) marks.color = a["data-text-color"] || style.color;
    if (style["background-color"] || a["data-background-color"])
      marks.backgroundColor = a["data-background-color"] || style["background-color"];
    if (style["font-weight"] === "bold" || Number(style["font-weight"]) >= 600) marks.bold = true;
    if (style["font-style"] === "italic") marks.italic = true;
    if (style["text-decoration"]?.includes("underline")) marks.underline = true;
    if (style["text-decoration"]?.includes("line-through")) marks.strikethrough = true;
    // Unknown wrappers and attributes remain visible opaque nodes, not silently unwrapped.
    if (
      !mark &&
      !(
        tag === "span" &&
        Object.keys(a).every((key) => ["style", "data-text-color", "data-background-color"].includes(key))
      )
    )
      return [opaque(node, true)];
    return inline(node.childNodes, marks);
  });
}
function listNodes(list: HtmlElement, depth: number): SlateElement[] {
  const a = attrs(list),
    style =
      a["data-type"] === "taskList"
        ? "todo"
        : styleMap(a)["list-style-type"] || (list.tagName === "ol" ? "decimal" : "disc");
  const result: SlateElement[] = [];
  let first = true;
  for (const item of list.childNodes.filter((node): node is HtmlElement => element(node) && node.tagName === "li")) {
    const ia = attrs(item);
    const nested: HtmlElement[] = [];
    const content: HtmlNode[] = [];
    const collect = (nodes: HtmlNode[]) => {
      for (const node of nodes) {
        if (element(node) && ["ul", "ol"].includes(node.tagName)) nested.push(node);
        else if (element(node) && style === "todo" && ["label", "input"].includes(node.tagName)) continue;
        else if (element(node) && node.tagName === "div") collect(node.childNodes);
        else content.push(node);
      }
    };
    collect(item.childNodes);
    // Plate's flat list representation only supports trailing nested lists.
    // Keep interleaved lists/content intact instead of changing their order.
    let sawList = false,
      interleaved = false;
    const checkOrder = (nodes: HtmlNode[]) => {
      for (const child of nodes) {
        if (element(child) && ["ul", "ol"].includes(child.tagName)) sawList = true;
        else if (element(child) && child.tagName === "div") checkOrder(child.childNodes);
        else if (sawList && (element(child) || textOf(child).trim())) interleaved = true;
      }
    };
    checkOrder(item.childNodes);
    if (interleaved) return [opaque(list, false)];
    const blocks = readBlocks(content);
    // A flat Plate item cannot express several sibling blocks. Keep the complete
    // list opaque instead of joining or deleting paragraphs/media.
    if (blocks.length > 1) return [opaque(list, false)];
    const value = blocks[0] ?? block("p", empty());
    const start = ia.value ?? (first && list.tagName === "ol" ? (a.start ?? "1") : undefined);
    Object.assign(
      value,
      { listStyleType: style, indent: depth },
      style === "todo" ? { checked: ia["data-checked"] === "true" } : {},
      start !== undefined && Number.isFinite(Number(start))
        ? { listStart: Number(start), listRestart: Number(start) }
        : {}
    );
    result.push(value);
    for (const child of nested) result.push(...listNodes(child, depth + 1));
    first = false;
  }
  return result;
}
function readBlock(node: HtmlElement): SlateElement[] {
  const a = attrs(node),
    style = styleMap(a),
    tag = node.tagName;
  const extra = style["text-align"] ? { align: style["text-align"] } : {};
  if (tag === "ul" || tag === "ol") return listNodes(node, 1);
  if (tag === "p" || /^h[1-6]$/.test(tag)) return [block(tag, inline(node.childNodes), a, extra)];
  if (tag === "blockquote") return [block(tag, readBlocks(node.childNodes), a, extra)];
  if (tag === "div" && a["data-block-type"] === "callout-component")
    return [block("comparison_callout", readBlocks(node.childNodes), a, a)];
  if (tag === "image-component" || tag === "img")
    return [
      block("sandboxImage", empty(), a, {
        ...a,
        src: a.src ?? "",
        aspectRatio: a.aspectratio,
        blockId: a.blockid ?? a["data-block-id"],
        assetId: a.assetid ?? a["data-asset-id"],
      }),
    ];
  if (tag === "hr") return [block("hr", empty(), a)];
  if (tag === "pre") {
    const code = node.childNodes.find((child): child is HtmlElement => element(child) && child.tagName === "code");
    const ca = code ? attrs(code) : {};
    const lang =
      a["data-language"] ||
      ca["data-language"] ||
      ca.class
        ?.split(/\s+/)
        .find((name) => name.startsWith("language-"))
        ?.slice(9);
    return [
      block(
        "code_block",
        textOf(code ?? node)
          .split("\n")
          .map((text) => block("code_line", [{ text }])),
        a,
        lang ? { lang } : {}
      ),
    ];
  }
  if (tag === "table") {
    const rows: HtmlElement[] = [],
      cols: number[] = [];
    let unsupported = false;
    const scan = (children: HtmlNode[]) => {
      for (const child of children)
        if (element(child)) {
          if (child.tagName === "tr") rows.push(child);
          else if (["thead", "tbody", "tfoot", "colgroup"].includes(child.tagName)) scan(child.childNodes);
          else if (child.tagName === "col")
            cols.push(Number.parseFloat(styleMap(attrs(child)).width || attrs(child).width || "0"));
          else unsupported = true;
        }
    };
    scan(node.childNodes);
    if (unsupported) return [opaque(node, false)];
    if (!cols.length && rows[0])
      for (const cell of rows[0].childNodes)
        if (element(cell)) {
          const ca = attrs(cell),
            widths = (ca.colwidth ?? "").split(",").map(Number);
          for (let column = 0; column < (Number(ca.colspan) || 1); column++)
            cols.push(widths[column] > 0 ? widths[column] : 0);
        }
    return [
      block(
        "table",
        rows.map((row) =>
          block(
            "tr",
            row.childNodes
              .filter((cell): cell is HtmlElement => element(cell) && ["td", "th"].includes(cell.tagName))
              .map((cell) => {
                const ca = attrs(cell),
                  cs = styleMap(ca);
                const colWidths = (ca.colwidth ?? "")
                  .split(",")
                  .map(Number)
                  .filter((width) => width > 0);
                return block(cell.tagName, readBlocks(cell.childNodes), ca, {
                  colSpan: Number(ca.colspan) || 1,
                  rowSpan: Number(ca.rowspan) || 1,
                  ...(colWidths.length ? { colWidths } : {}),
                  ...(cs["background-color"] || ca.background
                    ? { background: cs["background-color"] || ca.background }
                    : {}),
                  ...(cs.color || ca.textcolor ? { color: cs.color || ca.textcolor } : {}),
                });
              }),
            attrs(row)
          )
        ),
        a,
        cols.some((width) => width > 0) ? { colSizes: cols.map((width) => (width > 0 ? width : 160)) } : {}
      ),
    ];
  }
  return [opaque(node, false)];
}
function readBlocks(nodes: HtmlNode[]): SlateElement[] {
  const result: SlateElement[] = [];
  let pending: HtmlNode[] = [];
  const flush = () => {
    if (pending.some((node) => element(node) || textOf(node).trim())) result.push(block("p", inline(pending)));
    pending = [];
  };
  for (const node of nodes) {
    if (element(node) && isBlock(node.tagName)) {
      flush();
      result.push(...readBlock(node));
    } else pending.push(node);
  }
  flush();
  return result;
}
export function htmlToSlate(html: string): SlateValue {
  const fragment = parseFragment(html);
  cleanTree(fragment);
  const nodes = readBlocks(fragment.childNodes);
  return nodes.length ? nodes : [block("p", empty())];
}
function attributesHtml(attributes: Attributes): string {
  return Object.entries(cleanAttributes(attributes))
    .map(([key, value]) => ` ${key}="${escape(value)}"`)
    .join("");
}
function tagHtml(tag: string, a: Attributes, contents = "") {
  return `<${tag}${attributesHtml(a)}>${voidTags.has(tag) ? "" : `${contents}</${tag}>`}`;
}
function storedAttrs(node: SlateNode): Attributes {
  const value = node.htmlAttributes;
  return value && typeof value === "object"
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      )
    : {};
}
function leafHtml(node: SlateText): string {
  let html = escape(node.text).replaceAll("\n", "<br>");
  for (const [mark, tag] of Object.entries({
    bold: "strong",
    italic: "em",
    underline: "u",
    strikethrough: "s",
    code: "code",
    superscript: "sup",
    subscript: "sub",
  }))
    if (node[mark]) html = tagHtml(tag, {}, html);
  const style = [
    node.color ? `color:${node.color}` : "",
    node.backgroundColor ? `background-color:${node.backgroundColor}` : "",
  ]
    .filter(Boolean)
    .join(";");
  return style
    ? tagHtml(
        "span",
        {
          style,
          ...(node.color ? { "data-text-color": String(node.color) } : {}),
          ...(node.backgroundColor ? { "data-background-color": String(node.backgroundColor) } : {}),
        },
        html
      )
    : html;
}
function nodeHtml(node: SlateNode): string {
  if (typeof node.text === "string") return leafHtml(node as SlateText);
  const n = node as SlateElement,
    a = storedAttrs(n);
  if (n.type === "html_opaque" || n.type === "html_opaque_inline") return sanitizeHtml(String(n.html ?? ""));
  if (n.align) a.style = `${a.style ?? ""};text-align:${n.align}`;
  const children = () => writeNodes(n.children);
  if (n.type === "comparison_mention" || n.type === "comparison_callout") {
    for (const [key, value] of Object.entries(n))
      if (
        (key === "id" || key.startsWith("data-") || key.startsWith("entity_") || key === "label") &&
        typeof value === "string"
      )
        a[key] = value;
    if (n.type === "comparison_callout") a["data-block-type"] = "callout-component";
    return tagHtml(
      n.type === "comparison_mention" ? "mention-component" : "div",
      a,
      n.type === "comparison_mention" ? "" : children()
    );
  }
  if (n.type === "sandboxImage") {
    for (const key of ["src", "alt", "title", "width", "height", "alignment", "id", "status", "assetId", "blockId"])
      if (n[key] !== undefined) a[key.toLowerCase()] = String(n[key]);
    if (n.aspectRatio !== undefined) a.aspectratio = String(n.aspectRatio);
    return tagHtml("image-component", a);
  }
  if (n.type === "code_block") {
    const lang = typeof n.lang === "string" ? n.lang : "";
    return tagHtml(
      "pre",
      a,
      tagHtml(
        "code",
        lang ? { class: `language-${lang}`, "data-language": lang } : {},
        escape(n.children.map((line) => plainText(line)).join("\n"))
      )
    );
  }
  if (n.type === "a") return tagHtml("a", { ...a, href: String(n.url ?? "") }, children());
  if (n.type === "table") {
    const sizes = Array.isArray(n.colSizes) ? n.colSizes : [];
    const cols = sizes.length
      ? tagHtml("colgroup", {}, sizes.map((size) => tagHtml("col", { style: `width:${Number(size)}px` })).join(""))
      : "";
    return tagHtml("table", a, cols + tagHtml("tbody", {}, children()));
  }
  if (["td", "th"].includes(n.type)) {
    if (n.colSpan) a.colspan = String(n.colSpan);
    if (n.rowSpan) a.rowspan = String(n.rowSpan);
    if (Array.isArray(n.colWidths)) a.colwidth = n.colWidths.join(",");
    if (n.background) a.style = `${a.style ?? ""};background-color:${n.background}`;
    if (n.color) a.style = `${a.style ?? ""};color:${n.color}`;
  }
  if (/^(p|h[1-6]|blockquote|tr|td|th|hr)$/.test(n.type)) return tagHtml(n.type, a, children());
  // Unknown Slate data must be handled explicitly by its owner, not silently lost.
  throw new Error(`Unsupported Slate node type: ${n.type}`);
}
function plainText(node: SlateNode): string {
  return typeof node.text === "string" ? node.text : (node as SlateElement).children.map(plainText).join("");
}
type ListFrame = {
  depth: number;
  style: string;
  tag: string;
  attrs: Attributes;
  items: { body: string; nested: ListFrame[]; checked?: boolean }[];
};
function renderList(list: ListFrame): string {
  return tagHtml(
    list.tag,
    list.attrs,
    list.items
      .map((item) =>
        tagHtml(
          "li",
          list.style === "todo" ? { "data-type": "taskItem", "data-checked": String(item.checked === true) } : {},
          (list.style === "todo"
            ? `<label><input type="checkbox"${item.checked ? ' checked="checked"' : ""}><span></span></label><div>${item.body}</div>`
            : item.body) + item.nested.map(renderList).join("")
        )
      )
      .join("")
  );
}
function writeNodes(nodes: SlateNode[]): string {
  let html = "";
  const roots: ListFrame[] = [],
    stack: ListFrame[] = [];
  const flush = () => {
    html += roots.map(renderList).join("");
    roots.length = 0;
    stack.length = 0;
  };
  for (const node of nodes) {
    if (!node.listStyleType || typeof node.text === "string") {
      flush();
      html += nodeHtml(node);
      continue;
    }
    const depth = Math.max(1, Number(node.indent) || 1),
      style = String(node.listStyleType);
    while (stack.length && stack[stack.length - 1].depth > depth) stack.pop();
    let current = stack[stack.length - 1];
    if (current?.depth === depth && (current.style !== style || node.listRestart !== undefined)) {
      stack.pop();
      current = stack[stack.length - 1];
    }
    if (!current || current.depth !== depth) {
      const ordered = !["disc", "circle", "square", "todo", "none"].includes(style);
      const next: ListFrame = {
        depth,
        style,
        tag: ordered ? "ol" : "ul",
        attrs:
          style === "todo"
            ? { "data-type": "taskList" }
            : {
                style: `list-style-type:${style}`,
                ...(ordered ? { start: String(node.listRestart ?? node.listStart ?? 1) } : {}),
              },
        items: [],
      };
      if (current?.items.length) current.items[current.items.length - 1].nested.push(next);
      else roots.push(next);
      stack.push(next);
      current = next;
    }
    current.items.push({ body: nodeHtml(node), nested: [], checked: node.checked === true });
  }
  flush();
  return html;
}
/** Validate JSON/Yjs nodes at the trust boundary before rendering them. */
export function assertSlateNodes(nodes: readonly unknown[]): asserts nodes is readonly SlateNode[] {
  for (const node of nodes) {
    if (!node || typeof node !== "object") throw new Error("Invalid Slate node");
    if ("text" in node && typeof node.text === "string") continue;
    if (!("type" in node) || typeof node.type !== "string" || !("children" in node) || !Array.isArray(node.children))
      throw new Error("Invalid Slate element");
    assertSlateNodes(node.children);
  }
}
/** Synchronous serialization. Does not mutate nodes; safe to call in Node or browsers.
 * Accepts untyped Yjs Descendant arrays and validates their shape at runtime.
 */
export function slateToHtml(nodes: readonly unknown[]): string {
  assertSlateNodes(nodes);
  return writeNodes([...nodes]);
}
