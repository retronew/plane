import { useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@makeplane/propel/components/icon-button";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  Code2Icon,
  LinkIcon,
  BaselineIcon,
  PaintBucketIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
} from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { Input } from "@makeplane/propel/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { ColorSwatchPicker } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import { useFloatingToolbar, useFloatingToolbarState, offset, flip, shift } from "@platejs/floating";
import { upsertLink, unwrapLink } from "@platejs/link";
import { type TElement } from "platejs";
import {
  useEditorRef,
  useEditorSelector,
  useEventEditorValue,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
  useSelectionFragmentProp,
} from "platejs/react";
import { selectionBlockType, setSelectionBlockType } from "./selection-transforms";
import type { PlateComparisonEditorLabels } from "./plate-editor";
import { comparisonCommandLabels, executeComparisonCommand } from "./plate-kit";

// Adapted from Plate v53.5.1 registry floating-toolbar, turn-into-toolbar-button
// and font-color-toolbar-button. Propel owns the popup/focus primitives; the
// existing Plane color picker supplies presets, hex entry and continuous color.
const marks = ["bold", "italic", "underline", "strikethrough", "code"] as const;
const markIcons = {
  bold: BoldIcon,
  italic: ItalicIcon,
  underline: UnderlineIcon,
  strikethrough: StrikethroughIcon,
  code: Code2Icon,
};
const blockItems = [
  ["p", "paragraph"],
  ["h1", "heading1"],
  ["h2", "heading2"],
  ["h3", "heading3"],
  ["h4", "heading4"],
  ["h5", "heading5"],
  ["h6", "heading6"],
  ["disc", "bulletedList"],
  ["decimal", "numberedList"],
  ["todo", "todoList"],
  ["blockquote", "blockquote"],
  ["code_block", "codeBlock"],
] as const;
type Labels = PlateComparisonEditorLabels & typeof comparisonCommandLabels;
const popupClass = "ignore-click-outside/toolbar";

function MarkButton({ mark, label }: { mark: (typeof marks)[number]; label: string }) {
  const state = useMarkToolbarButtonState({ nodeType: mark });
  const {
    props: { pressed, ...buttonProps },
  } = useMarkToolbarButton(state);
  const Icon = markIcons[mark];
  return (
    <IconButton
      {...buttonProps}
      type="button"
      size="md"
      variant={pressed ? "tertiary" : "ghost"}
      icon={<Icon className="size-4" />}
      aria-label={label}
      aria-pressed={pressed}
    />
  );
}

function BlockSelector({ labels }: { labels: Labels }) {
  const editor = useEditorRef();
  const value = useSelectionFragmentProp({
    defaultValue: "p",
    getProp: (node) => selectionBlockType(node as TElement),
  });
  const items = blockItems.map(([blockType, key]) => ({ value: blockType, label: labels[key] }));
  return (
    <Select<string>
      items={items}
      value={items.some((item) => item.value === value) ? value : null}
      onValueChange={(type) => {
        if (type) setSelectionBlockType(editor, type);
      }}
    >
      <SelectTrigger
        size="md"
        width="fit"
        aria-label={labels.paragraph}
        placeholder={labels.paragraph}
        onMouseDown={(event) => event.preventDefault()}
      />
      <SelectContent
        finalFocus={() => {
          editor.tf.focus();
          return false;
        }}
      >
        <SelectList>
          <div className={popupClass}>
            {items.map((item) => (
              <SelectItem key={item.value} {...item} />
            ))}
          </div>
        </SelectList>
      </SelectContent>
    </Select>
  );
}

function LinkSelector({ labels }: { labels: Labels }) {
  const editor = useEditorRef();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const link = useEditorSelector(
    (current) => current.api.above<TElement & { url: string }>({ match: { type: "a" } })?.[0],
    []
  );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl(link?.url ?? "");
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <IconButton
            type="button"
            size="md"
            variant={link ? "tertiary" : "ghost"}
            icon={<LinkIcon className="size-4" />}
            aria-label={labels.link}
            aria-pressed={!!link}
            onMouseDown={(event) => event.preventDefault()}
          />
        }
      />
      <PopoverContent
        side="bottom"
        align="start"
        finalFocus={() => {
          editor.tf.focus();
          return false;
        }}
      >
        <form
          className={`${popupClass} flex w-72 flex-col gap-2`}
          onSubmit={(event) => {
            event.preventDefault();
            if (upsertLink(editor, { url: url.trim() })) setOpen(false);
          }}
        >
          <Input
            size="md"
            aria-label={labels.linkUrl}
            placeholder="https://"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            <Button
              type="submit"
              size="sm"
              stretch="auto"
              variant="primary"
              label={labels.apply}
              disabled={!url.trim()}
            />
            <Button
              type="button"
              size="sm"
              stretch="auto"
              variant="ghost"
              label={labels.unlink}
              disabled={!link}
              onClick={() => {
                unwrapLink(editor);
                setOpen(false);
              }}
            />
            <Button
              type="button"
              size="sm"
              stretch="auto"
              variant="ghost"
              label={t("cancel")}
              onClick={() => setOpen(false)}
            />
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function FontColorSelector({ mark, labels }: { mark: "color" | "backgroundColor"; labels: Labels }) {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const color = useEditorSelector((current) => current.api.mark(mark) as string | undefined, [mark]);
  const label = mark === "color" ? labels.textColor : labels.backgroundColor;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const used = [...editor.api.nodes({ at: [], match: (node) => typeof node[mark] === "string", mode: "all" })]
            .map(([node]) => String(node[mark]).toLowerCase())
            .filter((value) => /^#[\da-f]{6}$/i.test(value));
          setColors([...new Set(used)].slice(0, 19));
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <IconButton
            type="button"
            size="md"
            variant={open ? "tertiary" : "ghost"}
            aria-label={label}
            aria-pressed={open}
            icon={
              mark === "color" ? (
                <BaselineIcon className="size-4" style={{ color }} />
              ) : (
                <PaintBucketIcon className="size-4" style={{ color }} />
              )
            }
            onMouseDown={(event) => event.preventDefault()}
          />
        }
      />
      <PopoverContent
        side="bottom"
        align="start"
        finalFocus={() => {
          editor.tf.focus();
          return false;
        }}
      >
        <div className={`${popupClass} flex flex-col gap-3`}>
          <ColorSwatchPicker
            continuous
            value={color}
            onChange={(value) => {
              if (editor.selection) editor.tf.addMarks({ [mark]: value });
            }}
          />
          {colors.length > 0 && (
            <div className="flex max-w-56 flex-wrap gap-1">
              {colors.map((value) => (
                <Button
                  key={value}
                  stretch="auto"
                  type="button"
                  size="sm"
                  variant="ghost"
                  label={value}
                  aria-label={value}
                  aria-pressed={color === value}
                  icon={<span className="size-4 rounded-sm" style={{ backgroundColor: value }} />}
                  onClick={() => editor.tf.addMarks({ [mark]: value })}
                />
              ))}
            </div>
          )}
          <Button
            type="button"
            size="sm"
            stretch="auto"
            variant="ghost"
            label={labels.clearColor}
            onClick={() => {
              editor.tf.removeMarks(mark);
              setOpen(false);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AlignmentSelector({ labels }: { labels: Labels }) {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const alignment = useSelectionFragmentProp({ defaultValue: "left", getProp: (node) => node.align }) ?? "left";
  const items = [
    { value: "left", command: "alignLeft", icon: AlignLeftIcon },
    { value: "center", command: "alignCenter", icon: AlignCenterIcon },
    { value: "right", command: "alignRight", icon: AlignRightIcon },
    { value: "justify", command: "alignJustify", icon: AlignJustifyIcon },
  ] as const;
  const selected = items.find((item) => item.value === alignment) ?? items[0];
  const IconValue = selected.icon;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <IconButton
            size="md"
            variant={open ? "tertiary" : "ghost"}
            aria-label={labels[selected.command]}
            aria-pressed={open}
            icon={<IconValue className="size-4" />}
            onMouseDown={(event) => event.preventDefault()}
          />
        }
      />
      <PopoverContent
        side="bottom"
        align="start"
        finalFocus={() => {
          editor.tf.focus();
          return false;
        }}
      >
        <div className={`${popupClass} flex gap-1`}>
          {items.map(({ value, command, icon: Icon }) => (
            <IconButton
              key={value}
              size="md"
              variant={alignment === value ? "tertiary" : "ghost"}
              aria-label={labels[command]}
              aria-pressed={alignment === value}
              icon={<Icon className="size-4" />}
              onClick={() => {
                executeComparisonCommand(editor, command);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SelectionToolbarControls({ labels: providedLabels }: { labels: PlateComparisonEditorLabels }) {
  const labels = { ...comparisonCommandLabels, ...providedLabels };
  return (
    <>
      <div className="flex shrink-0 px-1">
        <BlockSelector labels={labels} />
      </div>
      <div className="flex shrink-0 gap-0.5 px-1">
        {marks.map((mark) => (
          <MarkButton key={mark} mark={mark} label={labels[mark]} />
        ))}
      </div>
      <div className="flex shrink-0 gap-0.5 px-1">
        <LinkSelector labels={labels} />
        <FontColorSelector mark="color" labels={labels} />
        <FontColorSelector mark="backgroundColor" labels={labels} />
      </div>
      <div className="flex shrink-0 px-1">
        <AlignmentSelector labels={labels} />
      </div>
    </>
  );
}

export function SelectionToolbar({ labels: providedLabels }: { labels: PlateComparisonEditorLabels }) {
  const labels = { ...comparisonCommandLabels, ...providedLabels };
  const editor = useEditorRef();
  const focusedEditorId = useEventEditorValue("focus");
  const state = useFloatingToolbarState({
    editorId: editor.id,
    focusedEditorId,
    floatingOptions: { placement: "top", middleware: [offset(12), flip(), shift({ padding: 8 })] },
  });
  const { ref, props, hidden, clickOutsideRef } = useFloatingToolbar(state);
  if (hidden || typeof document === "undefined") return null;
  return createPortal(
    <div ref={clickOutsideRef}>
      <fieldset
        ref={ref}
        {...props}
        aria-label={labels.toolbar}
        data-testid="selection-toolbar"
        className="z-50 flex max-w-[90vw] items-center gap-1 divide-x divide-subtle overflow-x-auto rounded-lg border border-subtle bg-surface-1 p-1 shadow-raised-200"
      >
        <SelectionToolbarControls labels={labels} />
      </fieldset>
    </div>,
    document.body
  );
}
