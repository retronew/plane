import type { JSONContent } from "@tiptap/core";
import type { SlateNode, SlateValue, SlateElement, SlateText } from "../plate-headless";
const nodeNames: Record<string, string> = {
  p: "paragraph",
  blockquote: "blockquote",
  code_block: "codeBlock",
  table: "table",
  tr: "tableRow",
  td: "tableCell",
  th: "tableHeader",
  hr: "horizontalRule",
  sandboxImage: "image-component",
  comparison_mention: "mention-component",
  comparison_callout: "callout-component",
};
const marks: Record<string, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strike",
  code: "code",
};
const convertToLegacy = (node: SlateNode): JSONContent => {
  if ("text" in node)
    return {
      type: "text",
      text: String(node.text ?? ""),
      marks: Object.entries(marks)
        .filter(([key]) => node[key])
        .map(([, type]) => ({ type })),
    };
  const { children, type, ...attrs } = node;
  if (/^h[1-6]$/.test(type))
    return { type: "heading", attrs: { ...attrs, level: Number(type[1]) }, content: children.map(convertToLegacy) };
  if (type === "a")
    return {
      type: "text",
      text: children.map((child) => ("text" in child ? child.text : "")).join(""),
      marks: [{ type: "link", attrs: { href: node.url } }],
    };
  if (type === "code_block")
    return {
      type: "codeBlock",
      attrs,
      content: [
        {
          type: "text",
          text: children
            .map((line) =>
              Array.isArray(line.children)
                ? (line as SlateElement).children.map((child) => ("text" in child ? child.text : "")).join("")
                : String((line as SlateText).text ?? "")
            )
            .join("\n"),
        },
      ],
    };
  return { type: nodeNames[type] ?? type, attrs, content: children.map(convertToLegacy) };
};
export function slateToLegacyJSON(value: SlateValue): JSONContent {
  const content: JSONContent[] = [];
  const stack: Array<{ indent: number; style: string; list: JSONContent; lastItem?: JSONContent }> = [];
  for (const node of value) {
    if (!node.listStyleType) {
      stack.length = 0;
      content.push(convertToLegacy(node));
      continue;
    }
    const indent = Number(node.indent ?? 1),
      style = String(node.listStyleType);
    while (
      stack.length &&
      (stack.at(-1)!.indent > indent || (stack.at(-1)!.indent === indent && stack.at(-1)!.style !== style))
    )
      stack.pop();
    if (!stack.length || stack.at(-1)!.indent < indent) {
      const list: JSONContent = {
        type: style === "todo" ? "taskList" : style === "decimal" ? "orderedList" : "bulletList",
        attrs: node.listStart ? { start: node.listStart } : undefined,
        content: [],
      };
      const parent = stack.at(-1)?.lastItem;
      if (parent) (parent.content ??= []).push(list);
      else content.push(list);
      stack.push({ indent, style, list });
    }
    const paragraph = convertToLegacy(node);
    if (paragraph.attrs) {
      delete paragraph.attrs.listStyleType;
      delete paragraph.attrs.indent;
      delete paragraph.attrs.checked;
    }
    const item: JSONContent = {
      type: style === "todo" ? "taskItem" : "listItem",
      attrs: style === "todo" ? { checked: Boolean(node.checked) } : undefined,
      content: [paragraph],
    };
    stack.at(-1)!.list.content!.push(item);
    stack.at(-1)!.lastItem = item;
  }
  return { type: "doc", content };
}
const convertFromLegacy = (node: JSONContent): SlateNode => {
  const attrs = node.attrs ?? {};
  if (node.type === "text") {
    const text = {
      text: node.text ?? "",
      ...Object.fromEntries(
        (node.marks ?? []).map((mark) => [
          Object.keys(marks).find((key) => marks[key] === mark.type) ?? mark.type,
          true,
        ])
      ),
    };
    const link = node.marks?.find((mark) => mark.type === "link");
    return link ? { type: "a", url: link.attrs?.href, children: [text] } : text;
  }
  if (node.type === "hardBreak") return { text: "\n" };
  if (node.type === "codeBlock")
    return {
      type: "code_block",
      ...attrs,
      children: (node.content?.map((n) => n.text ?? "").join("") ?? "")
        .split("\n")
        .map((text) => ({ type: "code_line", children: [{ text }] })),
    };
  const type =
    node.type === "heading"
      ? `h${attrs.level ?? 1}`
      : (Object.keys(nodeNames).find((key) => nodeNames[key] === node.type) ?? node.type ?? "p");
  return { ...attrs, type, children: node.content?.map(convertFromLegacy) ?? [{ text: "" }] };
};
export function legacyJSONToSlate(document: unknown): SlateValue {
  if (!document || typeof document !== "object" || !("type" in document) || document.type !== "doc")
    throw new Error("Expected a legacy document JSON root");
  const root = document as JSONContent;
  return (root.content ?? [])
    .flatMap((node) => flattenLegacy(node))
    .filter((node): node is SlateValue[number] => "children" in node);
}

function flattenLegacy(node: JSONContent, indent = 0, listStyleType?: string): SlateElement[] {
  if (["bulletList", "orderedList", "taskList"].includes(node.type ?? "")) {
    const style = node.type === "orderedList" ? "decimal" : node.type === "taskList" ? "todo" : "disc";
    return (node.content ?? []).flatMap((child) => flattenLegacy(child, indent + 1, style));
  }
  if (["listItem", "taskItem"].includes(node.type ?? ""))
    return (node.content ?? [])
      .flatMap((child) => flattenLegacy(child, indent, listStyleType))
      .map((child) => Object.assign(child, node.type === "taskItem" ? { checked: Boolean(node.attrs?.checked) } : {}));
  const converted = convertFromLegacy(node);
  if (!("children" in converted)) return [];
  return [{ ...converted, ...(listStyleType ? { indent, listStyleType } : {}) } as SlateElement];
}
