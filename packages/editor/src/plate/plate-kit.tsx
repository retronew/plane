import { MarkdownPlugin } from "@platejs/markdown";
import { ComparisonCodeBlock } from "./code-block";
import { ComparisonTable, ComparisonTableCell } from "./table-cell";
import {
  BaseSandboxImagePlugin,
  SandboxImagePlugin,
  SandboxImageElement,
  SandboxImageStaticElement,
} from "./image-plugin";
import {
  BaseComparisonMentionPlugin,
  ComparisonMentionPlugin,
  ComparisonMention,
  ComparisonMentionStatic,
  BaseComparisonCalloutPlugin,
  ComparisonCalloutPlugin,
  ComparisonCallout,
} from "./business-nodes";
import type { ReactNode } from "react";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import {
  BaseBlockquotePlugin,
  BaseBoldPlugin,
  BaseCodePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseH4Plugin,
  BaseH5Plugin,
  BaseH6Plugin,
  BaseHorizontalRulePlugin,
  BaseItalicPlugin,
  BaseStrikethroughPlugin,
  BaseUnderlinePlugin,
} from "@platejs/basic-nodes";
import {
  BaseFontColorPlugin,
  BaseFontBackgroundColorPlugin,
  BaseTextAlignPlugin,
  setAlign,
} from "@platejs/basic-styles";
import { BaseCodeBlockPlugin, toggleCodeBlock } from "@platejs/code-block";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { common, createLowlight } from "lowlight";
import { BaseIndentPlugin, indent as indentBlock, outdent } from "@platejs/indent";
import { BaseLinkPlugin } from "@platejs/link";
import { BaseListPlugin, isOrderedList, toggleList } from "@platejs/list";
import {
  BaseTablePlugin,
  insertTable,
  insertTableRow,
  insertTableColumn,
  deleteRow,
  deleteColumn,
  deleteTable,
} from "@platejs/table";
import { TablePlugin } from "@platejs/table/react";
import {
  BaseParagraphPlugin,
  createSlateEditor,
  ElementApi,
  NodeApi,
  normalizeNodeId,
  type SlateEditor,
  type SlatePlugins,
  type TElement,
  type Value,
} from "platejs";
import { toPlatePlugin } from "platejs/react";
import { serializeHtml } from "platejs/static";

type NodeProps = { attributes: Record<string, unknown>; children?: ReactNode; element: TElement; editor: SlateEditor };

function StaticParagraph({ attributes, children, element }: NodeProps) {
  return (
    <p
      {...attributes}
      data-comparison-list={element.listStyleType ? String(element.listStyleType) : undefined}
      data-comparison-indent={element.indent}
      data-comparison-start={element.listRestart ?? element.listStart}
      data-comparison-restart={element.listRestart}
      data-comparison-checked={element.listStyleType === "todo" ? Boolean(element.checked) : undefined}
    >
      {children}
    </p>
  );
}
function Paragraph({ attributes, children, element }: NodeProps) {
  const paragraph = (
    <p {...attributes} className="editor-paragraph-block">
      {children}
    </p>
  );
  if (!element.listStyleType) return paragraph;
  const ordered = element.listStyleType !== "todo" && isOrderedList(element);
  const List = ordered ? "ol" : "ul";
  return (
    <List
      start={ordered ? Number(element.listStart ?? 1) : undefined}
      style={{
        listStyleType: element.listStyleType === "todo" ? "none" : String(element.listStyleType),
        marginLeft: `${Math.max(1, Number(element.indent ?? 1)) * 24}px`,
      }}
    >
      <li
        data-type={element.listStyleType === "todo" ? "taskItem" : undefined}
        data-checked={element.listStyleType === "todo" ? Boolean(element.checked) : undefined}
      >
        {element.listStyleType === "todo" && (
          <input
            type="checkbox"
            checked={Boolean(element.checked)}
            readOnly
            aria-label={NodeApi.string(element) || "Task"}
          />
        )}
        {paragraph}
      </li>
    </List>
  );
}
function EditableParagraph(props: NodeProps) {
  const { element, editor, attributes, children } = props;
  if (element.listStyleType !== "todo") return <Paragraph {...props} />;
  return (
    <div
      {...attributes}
      data-type="taskItem"
      data-checked={Boolean(element.checked)}
      className="flex items-start gap-2"
      style={{ marginLeft: `${Math.max(1, Number(element.indent ?? 1)) * 24}px` }}
    >
      <span contentEditable={false} className="pt-1">
        <Checkbox
          checked={Boolean(element.checked)}
          aria-label={NodeApi.string(element) || "Task"}
          onCheckedChange={(checked) => {
            const at = editor.api.findPath(element);
            if (at) editor.tf.setNodes({ checked: Boolean(checked) }, { at });
          }}
        />
      </span>
      <span className="editor-paragraph-block min-w-0 flex-1">{children}</span>
    </div>
  );
}
function Heading({ attributes, children, element }: NodeProps) {
  const Tag = element.type as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <Tag {...attributes} className="editor-heading-block">
      {children}
    </Tag>
  );
}
function Quote({ attributes, children }: NodeProps) {
  return (
    <blockquote {...attributes} className="my-3 border-l-2 border-strong pl-4 text-secondary">
      {children}
    </blockquote>
  );
}
function Bold({ attributes, children }: NodeProps) {
  return <strong {...attributes}>{children}</strong>;
}
function Italic({ attributes, children }: NodeProps) {
  return <em {...attributes}>{children}</em>;
}
function Underline({ attributes, children }: NodeProps) {
  return <u {...attributes}>{children}</u>;
}
function Strikethrough({ attributes, children }: NodeProps) {
  return <s {...attributes}>{children}</s>;
}
function Code({ attributes, children }: NodeProps) {
  return (
    <code
      {...attributes}
      className="rounded-sm border-[0.5px] border-subtle bg-layer-3 px-[6px] py-[1.5px] font-code font-medium text-(--extended-color-orange-600)"
    >
      {children}
    </code>
  );
}
function Link({ attributes, children, element }: NodeProps) {
  const url = String(element.url ?? "");
  return (
    <a
      {...attributes}
      href={/^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : undefined}
      rel="noopener noreferrer"
      className="text-accent-primary underline"
    >
      {children}
    </a>
  );
}
function Table({ attributes, children }: NodeProps) {
  return (
    <table {...attributes} className="w-full border-collapse border border-strong">
      <tbody>{children}</tbody>
    </table>
  );
}
function Row({ attributes, children }: NodeProps) {
  return <tr {...attributes}>{children}</tr>;
}
function Cell({ attributes, children, element }: NodeProps) {
  const Tag = element.type === "th" ? "th" : "td";
  return (
    <Tag
      {...attributes}
      colSpan={Number(element.colSpan ?? 1)}
      rowSpan={Number(element.rowSpan ?? 1)}
      className="min-w-24 border border-strong px-3 py-2 align-top"
    >
      {children}
    </Tag>
  );
}
function CodeBlock({ attributes, children, element }: NodeProps) {
  return (
    <pre
      {...attributes}
      data-language={element.lang || undefined}
      className="comparison-code-block my-2 overflow-x-auto rounded-lg bg-layer-3 p-4 text-primary"
    >
      <code data-language={element.lang} className={element.lang ? `language-${String(element.lang)}` : undefined}>
        {children}
      </code>
    </pre>
  );
}
function CodeSyntax({
  attributes,
  children,
  leaf,
}: {
  attributes: Record<string, unknown>;
  children?: ReactNode;
  leaf: { className?: string };
}) {
  return (
    <span {...attributes} className={leaf.className}>
      {children}
    </span>
  );
}
function CodeLine({ attributes, children }: NodeProps) {
  return (
    <div {...attributes} style={{ whiteSpace: "pre-wrap" }}>
      {children}
    </div>
  );
}
function HorizontalRule({ attributes, children }: NodeProps) {
  return (
    <div {...attributes}>
      <hr contentEditable={false} className="my-4 border-strong" />
      {children}
    </div>
  );
}

const blockTypes = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"];
export const comparisonBasePlugins: SlatePlugins = [
  MarkdownPlugin,
  BaseSandboxImagePlugin,
  BaseComparisonMentionPlugin,
  BaseComparisonCalloutPlugin,
  BaseParagraphPlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseH4Plugin,
  BaseH5Plugin,
  BaseH6Plugin,
  BaseBlockquotePlugin,
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseStrikethroughPlugin,
  BaseCodePlugin,
  BaseHorizontalRulePlugin,
  BaseCodeBlockPlugin,
  BaseLinkPlugin,
  BaseTablePlugin,
  BaseIndentPlugin.configure({ inject: { targetPlugins: blockTypes } }),
  BaseListPlugin,
  BaseFontColorPlugin,
  BaseFontBackgroundColorPlugin,
  BaseTextAlignPlugin.configure({ inject: { targetPlugins: blockTypes } }),
];
export const comparisonComponents = {
  [BaseSandboxImagePlugin.key]: SandboxImageStaticElement,
  [BaseComparisonMentionPlugin.key]: ComparisonMentionStatic,
  [BaseComparisonCalloutPlugin.key]: ComparisonCallout,
  p: StaticParagraph,
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  blockquote: Quote,
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strikethrough: Strikethrough,
  code: Code,
  a: Link,
  table: Table,
  tr: Row,
  td: Cell,
  th: Cell,
  code_block: CodeBlock,
  code_line: CodeLine,
  code_syntax: CodeSyntax,
  hr: HorizontalRule,
};
export const comparisonEditableComponents = {
  ...comparisonComponents,
  [BaseSandboxImagePlugin.key]: SandboxImageElement,
  [BaseComparisonMentionPlugin.key]: ComparisonMention,
  p: EditableParagraph,
  code_block: ComparisonCodeBlock,
  table: ComparisonTable,
  td: ComparisonTableCell,
  th: ComparisonTableCell,
};
const lowlight = createLowlight(common);
export const comparisonPlugins = comparisonBasePlugins.map((plugin) =>
  plugin.key === BaseSandboxImagePlugin.key
    ? SandboxImagePlugin
    : plugin.key === BaseComparisonMentionPlugin.key
      ? ComparisonMentionPlugin
      : plugin.key === BaseComparisonCalloutPlugin.key
        ? ComparisonCalloutPlugin
        : plugin.key === BaseTablePlugin.key
          ? TablePlugin
          : plugin.key === BaseCodeBlockPlugin.key
            ? CodeBlockPlugin.configure({ options: { lowlight } })
            : toPlatePlugin(plugin)
);

export const comparisonCommandLabels = {
  paragraph: "Paragraph",
  heading1: "Heading 1",
  heading2: "Heading 2",
  blockquote: "Quote",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strikethrough: "Strikethrough",
  code: "Inline code",
  heading3: "Heading 3",
  heading4: "Heading 4",
  heading5: "Heading 5",
  heading6: "Heading 6",
  bulletedList: "Bulleted list",
  numberedList: "Numbered list",
  todoList: "Task list",
  indent: "Indent",
  outdent: "Outdent",
  link: "Link",
  linkUrl: "Link URL",
  apply: "Apply",
  unlink: "Remove link",
  table: "Insert table",
  insertRow: "Insert row",
  insertColumn: "Insert column",
  deleteRow: "Delete row",
  deleteColumn: "Delete column",
  deleteTable: "Delete table",
  codeBlock: "Code block",
  horizontalRule: "Divider",
  alignLeft: "Align left",
  alignCenter: "Align center",
  alignRight: "Align right",
  alignJustify: "Justify",
  textColor: "Text color",
  backgroundColor: "Background color",
  clearColor: "Reset color",
  callout: "Callout",
  image: "Image",
  uploadFailed: "Image upload failed",
};
export type ComparisonCommand =
  | "callout"
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6"
  | "blockquote"
  | "bulletedList"
  | "numberedList"
  | "todoList"
  | "indent"
  | "outdent"
  | "table"
  | "insertRow"
  | "insertColumn"
  | "deleteRow"
  | "deleteColumn"
  | "deleteTable"
  | "codeBlock"
  | "horizontalRule"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "alignJustify";
export function executeComparisonCommand(editor: SlateEditor, command: ComparisonCommand) {
  if (command.startsWith("heading")) {
    editor.tf.toggleBlock(`h${command.slice(-1)}`);
    return;
  }
  switch (command) {
    case "callout":
      editor.tf.insertNodes({
        type: "comparison_callout",
        "data-block-type": "callout-component",
        children: [{ type: "p", children: [{ text: "" }] }],
      });
      break;
    case "paragraph":
      editor.tf.toggleBlock("p");
      break;
    case "blockquote":
      editor.tf.toggleBlock("blockquote");
      break;
    case "bulletedList":
      toggleList(editor, { listStyleType: "disc" });
      break;
    case "numberedList":
      toggleList(editor, { listStyleType: "decimal" });
      break;
    case "todoList":
      toggleList(editor, { listStyleType: "todo" });
      break;
    case "indent":
      indentBlock(editor);
      break;
    case "outdent":
      outdent(editor);
      break;
    case "table":
      insertTable(editor, { rowCount: 3, colCount: 3 }, { select: true });
      break;
    case "insertRow":
      insertTableRow(editor, { select: true });
      break;
    case "insertColumn":
      insertTableColumn(editor, { select: true });
      break;
    case "deleteRow":
      deleteRow(editor);
      break;
    case "deleteColumn":
      deleteColumn(editor);
      break;
    case "deleteTable":
      deleteTable(editor);
      break;
    case "codeBlock":
      toggleCodeBlock(editor);
      break;
    case "horizontalRule":
      editor.tf.insertNodes([
        { type: "hr", children: [{ text: "" }] },
        { type: "p", children: [{ text: "" }] },
      ]);
      break;
    case "alignLeft":
      setAlign(editor, "left");
      break;
    case "alignCenter":
      setAlign(editor, "center");
      break;
    case "alignRight":
      setAlign(editor, "right");
      break;
    case "alignJustify":
      setAlign(editor, "justify");
      break;
  }
}

export function deserializeComparisonHtml(editor: SlateEditor, html: string): Value {
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const wrapper of document.querySelectorAll('[data-slate-type="hr"]'))
    wrapper.replaceWith(document.createElement("hr"));
  for (const code of document.querySelectorAll("pre > code")) {
    const lines = code.querySelectorAll('[data-slate-type="code_line"]');
    if (lines.length)
      code.textContent = Array.from(lines, (line) => {
        for (const placeholder of line.querySelectorAll("[data-slate-zero-width]")) placeholder.remove();
        return line.textContent === "﻿" ? "" : line.textContent;
      }).join("\n");
  }
  // Plate's list model is flat. Capture ancestry and numbering before removing
  // HTML list containers; listRestart (not only listStart) survives normalization.
  const listMetadata = Array.from(document.querySelectorAll("li"), (item) => {
    const parent = item.parentElement;
    const task = item.dataset.type === "taskItem" || parent?.getAttribute("data-type") === "taskList";
    const listStyleType = task
      ? "todo"
      : parent?.style.listStyleType || (parent?.tagName === "OL" ? "decimal" : "disc");
    let indent = 0;
    for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.matches("ul,ol")) indent++;
    }
    const first = !item.previousElementSibling;
    const restart =
      item.getAttribute("value") ?? (first && parent?.tagName === "OL" ? (parent.getAttribute("start") ?? "1") : null);
    item.dataset.listStyleType = listStyleType;
    item.dataset.indent = String(Math.max(1, indent));
    if (task) {
      for (const control of item.querySelectorAll(":scope > label, :scope > input")) control.remove();
    }
    return {
      listStyleType,
      indent: Math.max(1, indent),
      ...(task ? { checked: item.dataset.checked === "true" } : {}),
      ...(restart !== null && Number.isFinite(Number(restart))
        ? { listRestart: Number(restart), listStart: Number(restart) }
        : {}),
    };
  });
  // Move descendants out before flattening each item, in document order.
  // Reverse traversal handles multiple nested lists without reversing siblings.
  const lists = Array.from(document.querySelectorAll("ul,ol"));
  for (let index = lists.length - 1; index >= 0; index--) {
    const list = lists[index];
    const item = list.closest("li");
    if (item) item.after(list);
    list.replaceWith(...Array.from(list.childNodes));
  }
  for (const item of document.querySelectorAll("li")) {
    const blocks = Array.from(item.querySelectorAll("div,p"));
    for (let index = blocks.length - 1; index >= 0; index--) {
      const block = blocks[index];
      block.replaceWith(...Array.from(block.childNodes));
    }
  }
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.startsWith("data-slate-")) element.removeAttribute(attribute.name);
    }
  }
  const codeLanguages = Array.from(document.querySelectorAll("pre"), (pre) => {
    const code = pre.querySelector("code");
    return (
      pre.getAttribute("data-language") ||
      code?.getAttribute("data-language") ||
      Array.from(code?.classList ?? [])
        .find((name) => name.startsWith("language-"))
        ?.slice(9)
    );
  });
  const value: Value = editor.api.html
    .deserialize({ element: document.body.innerHTML })
    .map((node) => (ElementApi.isElement(node) ? node : { type: "p", children: [node] }));
  let listIndex = 0;
  let codeIndex = 0;
  const restoreLists = (nodes: Value) => {
    for (const node of nodes) {
      if (node.listStyleType) Object.assign(node, listMetadata[listIndex++]);
      if (node.type === "code_block") {
        const language = codeLanguages[codeIndex++];
        if (language) node.lang = language;
      }
      restoreLists(node.children.filter(ElementApi.isElement));
    }
  };
  restoreLists(value);
  // Table merge/row/column transforms index cells by ID, including imported cells.
  return normalizeNodeId(value.length ? value : [{ type: "p", children: [{ text: "" }] }]);
}
// Rebuild sibling runs as real HTML lists, with nested lists inside the preceding
// item. Process every block container so tables and callouts work as well.
function groupHtmlLists(parent: Element, document: Document) {
  const stack: { indent: number; style: string; list: HTMLElement; item: HTMLLIElement | null }[] = [];
  for (const child of Array.from(parent.children)) {
    groupHtmlLists(child, document);
    const style = child.getAttribute("data-comparison-list");
    if (!style) {
      stack.length = 0;
      continue;
    }
    const indent = Math.max(1, Number(child.getAttribute("data-comparison-indent") ?? 1));
    while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
    let current = stack[stack.length - 1];
    if (current?.indent === indent && (current.style !== style || child.hasAttribute("data-comparison-restart"))) {
      stack.pop();
      current = stack[stack.length - 1];
    }
    if (!current || current.indent !== indent) {
      const ordered = style !== "todo" && isOrderedList({ type: "p", children: [], listStyleType: style });
      const list = document.createElement(ordered ? "ol" : "ul");
      if (style === "todo") list.dataset.type = "taskList";
      else list.style.listStyleType = style;
      if (ordered) list.setAttribute("start", child.getAttribute("data-comparison-start") ?? "1");
      if (current?.item) current.item.append(list);
      else parent.insertBefore(list, child);
      current = { indent, style, list, item: null };
      stack.push(current);
    }
    // HTML nesting supplies indentation; Plate's injected paragraph margin would
    // otherwise indent the content a second time in the legacy editor.
    if (child instanceof HTMLElement) child.style.removeProperty("margin-left");
    const item = document.createElement("li");
    if (style === "todo") {
      item.dataset.type = "taskItem";
      item.dataset.checked = child.getAttribute("data-comparison-checked") ?? "false";
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      if (item.dataset.checked === "true") checkbox.setAttribute("checked", "checked");
      label.append(checkbox, document.createElement("span"));
      const content = document.createElement("div");
      content.append(child);
      item.append(label, content);
    } else item.append(child);
    for (const attribute of Array.from(child.attributes)) {
      if (attribute.name.startsWith("data-comparison-")) child.removeAttribute(attribute.name);
    }
    current.list.append(item);
    current.item = item;
  }
}

export async function serializeComparisonHtml(value: Value): Promise<string> {
  const editor = createSlateEditor({
    plugins: comparisonBasePlugins,
    override: { components: comparisonComponents },
    value: structuredClone(value),
  });
  const html = await serializeHtml(editor, { stripClassNames: true, stripDataAttributes: false });
  const document = new DOMParser().parseFromString(html, "text/html");
  groupHtmlLists(document.body, document);
  // Tiptap reads language-* classes; Plate's class stripping removes them.
  for (const code of document.querySelectorAll("pre > code[data-language]")) {
    const language = code.getAttribute("data-language");
    if (language) code.className = `language-${language}`;
  }
  for (const wrapper of document.querySelectorAll('[data-slate-type="hr"]'))
    wrapper.replaceWith(document.createElement("hr"));
  for (const code of document.querySelectorAll("pre > code")) {
    const lines = code.querySelectorAll('[data-slate-type="code_line"]');
    if (lines.length)
      code.textContent = Array.from(lines, (line) => {
        for (const placeholder of line.querySelectorAll("[data-slate-zero-width]")) placeholder.remove();
        return line.textContent === "﻿" ? "" : line.textContent;
      }).join("\n");
  }
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.startsWith("data-slate-")) element.removeAttribute(attribute.name);
    }
  }
  return document.body.firstElementChild?.innerHTML ?? "";
}
