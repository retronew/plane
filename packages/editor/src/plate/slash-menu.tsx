/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Rich command options require icons and preserve editor focus; native select cannot provide this UI. */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import { Button } from "@makeplane/propel/components/button";
import {
  TextOutline,
  H1Outline,
  H2Outline,
  H3Outline,
  H4Outline,
  H5Outline,
  H6Outline,
  NumberedListOutline,
  ListOutline,
  ToDoOutline,
  TableEditorOutline,
  QuoteOutline,
  CodeOutline,
  ImageOutline,
  MinusSquareOutline,
  ChatOutline,
} from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { type SlateEditor, type TRange } from "platejs";
import { useEditorRef, useEditorSelector } from "platejs/react";
import type { EditorRefApi } from "../types";
import { isPlateFeatureDisabled } from "./capabilities";
import { executeComparisonCommand, type ComparisonCommand } from "./plate-kit";

// Keep slash text in Slate, not an ephemeral inline void/input node: temporary
// UI state must not enter the shared Yjs document or its HTML serializer.
export const slashItems = [
  { command: "paragraph", label: "text", terms: "text paragraph p 文本 段落", icon: TextOutline, group: 0 },
  ...([H1Outline, H2Outline, H3Outline, H4Outline, H5Outline, H6Outline] as const).map((icon, index) => ({
    command: `heading${index + 1}` as ComparisonCommand,
    label: `heading_${index + 1}`,
    terms: `heading h${index + 1} 标题 ${["一级", "二级", "三级", "四级", "五级", "六级"][index]}`,
    icon,
    group: 0,
  })),
  {
    command: "numberedList",
    label: "numbered_list",
    terms: "ordered numbered list 有序列表",
    icon: NumberedListOutline,
    group: 1,
  },
  {
    command: "bulletedList",
    label: "bulleted_list",
    terms: "unordered bullet list 无序列表",
    icon: ListOutline,
    group: 1,
  },
  { command: "todoList", label: "to_do_list", terms: "todo task checkbox 待办列表 任务", icon: ToDoOutline, group: 1 },
  { command: "table", label: "table", terms: "table 表格", icon: TableEditorOutline, group: 2 },
  { command: "blockquote", label: "quote", terms: "blockquote quote 引用", icon: QuoteOutline, group: 2 },
  { command: "codeBlock", label: "code", terms: "code block 代码", icon: CodeOutline, group: 2 },
  { command: "image", label: "image", terms: "image picture photo 图片", icon: ImageOutline, group: 3 },
  {
    command: "horizontalRule",
    label: "divider",
    terms: "divider horizontal rule 分隔线",
    icon: MinusSquareOutline,
    group: 3,
  },
  { command: "callout", label: "callout", terms: "callout alert info 提示", icon: ChatOutline, group: 3 },
] as const;
export function filterSlashItems(query: string, disabled: readonly string[]) {
  return slashItems.filter(
    (item) =>
      !isPlateFeatureDisabled(disabled, item.command.startsWith("heading") ? "heading" : item.command) &&
      !disabled.includes(
        item.command === "bulletedList" ? "bulletList" : item.command === "numberedList" ? "orderedList" : item.command
      ) &&
      item.terms.toLowerCase().includes(query.trim().toLowerCase())
  );
}
export function getSlashMatch(editor: SlateEditor): { query: string; range: TRange; key: string } | null {
  if (!editor.selection || editor.api.isExpanded()) return null;
  const block = editor.api.block();
  if (!block || ["code_line", "code_block"].includes(block[0].type)) return null;
  const end = editor.selection.focus;
  const start = editor.api.start(block[1]);
  if (!start) return null;
  const text = editor.api.string({ anchor: start, focus: end });
  const match = /(?:^|\s)\/([^/\n]*)$/.exec(text);
  if (!match) return null;
  const anchor = editor.api.before(end, { distance: match[1].length + 1, unit: "character" });
  if (!anchor) return null;
  return { query: match[1], range: { anchor, focus: end }, key: `${anchor.path.join(".")}:${anchor.offset}` };
}
export function executeSlashCommand(editor: SlateEditor, range: TRange, command: string, api: EditorRefApi) {
  editor.tf.withoutNormalizing(() => {
    editor.tf.select(range);
    editor.tf.delete();
    if (command === "image") api.executeMenuItemCommand({ itemKey: "image", savedSelection: null });
    else executeComparisonCommand(editor, command as ComparisonCommand);
  });
}
export function SlashMenu({ api, disabled }: { api: EditorRefApi; disabled: readonly string[] }) {
  const editor = useEditorRef();
  const { t } = useTranslation();
  const id = useId();
  const match = useEditorSelector((current) => getSlashMatch(current), []);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const update = () => setFocused(editor.api.toDOMNode(editor)?.contains(document.activeElement) ?? false);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [editor]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [active, setActive] = useState({ query: "", index: 0 });
  const list = useRef<HTMLDivElement>(null);
  const items = filterSlashItems(match?.query ?? "", disabled);
  const index = Math.min(active.query === match?.query ? active.index : 0, Math.max(0, items.length - 1));
  const open = Boolean(match && focused && dismissed !== match.key && !disabled.includes("slash-commands"));
  const { refs, floatingStyles } = useFloating({
    open,
    placement: "bottom-start",
    middleware: [offset(6), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Reset dismissal when Slate removes the trigger, including remote operations.
    if (!match) setDismissed(null);
    if (!open || !match) return;
    refs.setPositionReference({
      getBoundingClientRect: () => editor.api.toDOMRange(match.range)?.getBoundingClientRect() ?? new DOMRect(),
    });
  }, [editor, match, open, refs]);
  const choose = (command: string) => {
    const current = getSlashMatch(editor);
    if (!current || !open) return;
    setDismissed(current.key);
    executeSlashCommand(editor, current.range, command, api);
    editor.tf.focus();
  };
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.isComposing || !["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") setDismissed(match!.key);
      else if (event.key === "Enter") {
        if (items[index]) choose(items[index].command);
      } else
        setActive({
          query: match!.query,
          index: items.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : 0,
        });
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  });
  useEffect(() => {
    if (index >= 0 && match?.query !== undefined)
      list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index, match?.query]);
  if (!open) return null;
  return createPortal(
    <div
      role="presentation"
      // oxlint-disable-next-line react/refs -- Floating UI exposes a callback ref, not a mutable ref read.
      ref={refs.setFloating}
      style={{ ...floatingStyles, zIndex: 60 }}
      data-plane-plate-menu="open"
      data-prevent-outside-click
      className="w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-subtle-1 bg-surface-1 p-1.5 shadow-raised-200"
      onMouseDown={(event) => event.preventDefault()}
    >
      <div
        ref={list}
        id={id}
        role="listbox"
        tabIndex={-1}
        aria-label={t("editor_comparison.commands")}
        aria-activedescendant={`${id}-${index}`}
        className="vertical-scrollbar scrollbar-sm max-h-[min(29rem,calc(100dvh-3rem))] overflow-y-auto overscroll-contain rounded-md"
      >
        {items.map((item, position) => (
          <div
            key={item.command}
            className={
              position > 0 && items[position - 1].group !== item.group
                ? "mt-1 border-t border-subtle-1 pt-1"
                : undefined
            }
          >
            <Button
              id={`${id}-${position}`}
              role="option"
              aria-selected={index === position}
              tabIndex={-1}
              variant="ghost"
              size="sm"
              stretch="full"
              render={
                <button
                  aria-label={t(`web.${item.label}` as Parameters<typeof t>[0])}
                  className={`min-h-8 justify-start gap-2.5 rounded-md px-2.5 py-1.5 text-body-xs-regular ${index === position ? "bg-layer-transparent-hover" : ""}`}
                />
              }
              icon={<item.icon className="size-4 text-secondary" />}
              label={t(`web.${item.label}` as Parameters<typeof t>[0])}
              onMouseEnter={() => setActive({ query: match!.query, index: position })}
              onClick={() => choose(item.command)}
            />
          </div>
        ))}
        {!items.length && (
          <div role="status" className="px-2.5 py-2 text-body-xs-regular text-secondary">
            {t("web.no_results_found")}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
