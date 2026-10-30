import { useRef, useState } from "react";
import { BaselineIcon, CheckIcon, EraserIcon, PaintBucketIcon, PlusIcon } from "lucide-react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Button } from "@makeplane/propel/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { useTranslation } from "@plane/i18n";
import { useEditorRef, useEditorSelector } from "platejs/react";
import { DEFAULT_COLORS, DEFAULT_CUSTOM_COLORS } from "./font-color-palette";

// Adapted from Plate's registry font-color-toolbar-button. Keep Plane's popup
// primitives so keyboard focus and peek outside-click handling stay consistent.
export function FontColorToolbarButton({
  mark,
  label,
  clearLabel,
}: {
  mark: "color" | "backgroundColor";
  label: string;
  clearLabel: string;
}) {
  const editor = useEditorRef();
  const { t } = useTranslation();
  const color = useEditorSelector((current) => current.api.mark(mark) as string | undefined, [mark]);
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>();
  const [colorsQueue, setColorsQueue] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(editor.selection);
  const activeColor = open ? selectedColor : color;
  const recordColor = (value: string) => {
    const normalized = value.toLowerCase();
    if (!/^#[\da-f]{6}$/i.test(normalized)) return;
    setColorsQueue((previous) => [normalized, ...previous.filter((item) => item !== normalized)].slice(0, 30));
  };
  const applyColor = (value: string, close = true) => {
    if (!selection.current) return;
    editor.tf.select(selection.current);
    editor.tf.addMarks({ [mark]: value });
    selection.current = editor.selection;
    setSelectedColor(value);
    recordColor(value);
    if (close) setOpen(false);
  };
  const customColors = [...new Set([...DEFAULT_CUSTOM_COLORS, ...colorsQueue])]
    .filter(
      (value) =>
        !DEFAULT_COLORS.some((item) => item.toLowerCase() === value.toLowerCase()) ||
        DEFAULT_CUSTOM_COLORS.includes(value)
    )
    .slice(0, 19);
  const swatches = (values: string[]) => (
    <fieldset className="grid grid-cols-[repeat(10,24px)] place-items-center gap-1">
      {values.map((value) => {
        const bright =
          (Number.parseInt(value.slice(1, 3), 16) * 299 +
            Number.parseInt(value.slice(3, 5), 16) * 587 +
            Number.parseInt(value.slice(5, 7), 16) * 114) /
            1000 >
          130;
        return (
          <IconButton
            key={value}
            type="button"
            size="sm"
            variant="ghost"
            aria-label={value}
            aria-pressed={activeColor?.toLowerCase() === value.toLowerCase()}
            render={
              <button
                aria-label={value}
                className="my-1 size-6! min-h-0! min-w-0! rounded-full! border border-subtle-1 p-0! hover:ring-2 hover:ring-accent-strong hover:ring-offset-1 focus-visible:ring-2 focus-visible:ring-accent-strong"
                style={{ backgroundColor: value, color: bright ? "#000000" : "#ffffff" }}
              />
            }
            icon={
              activeColor?.toLowerCase() === value.toLowerCase() ? (
                <CheckIcon className="size-3" strokeWidth={3} />
              ) : (
                <span />
              )
            }
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyColor(value)}
          />
        );
      })}
    </fieldset>
  );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          selection.current = editor.selection ? structuredClone(editor.selection) : null;
          setSelectedColor(color);
          const used = [
            ...editor.api.nodes({
              at: [],
              match: (node) => "text" in node && typeof node[mark] === "string",
              mode: "all",
            }),
          ]
            .map(([node]) => String(node[mark]).toLowerCase())
            .filter((value) => /^#[\da-f]{6}$/i.test(value));
          setColorsQueue((previous) => [...new Set([...used, ...previous])].slice(0, 30));
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
        <div
          data-prevent-outside-click
          className="ignore-click-outside/toolbar flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 p-1"
        >
          <p className="px-1 text-12 font-medium text-secondary">{t("editor_comparison.customColors")}</p>
          {swatches(customColors)}
          <div>
            <IconButton
              type="button"
              size="sm"
              variant="secondary"
              aria-label={t("editor_comparison.customColor")}
              icon={<PlusIcon className="size-4" />}
              render={<button aria-label={t("editor_comparison.customColor")} className="rounded-full!" />}
              onClick={() => input.current?.click()}
            />
            <input
              ref={input}
              type="color"
              tabIndex={-1}
              aria-label={t("editor_comparison.customColor")}
              className="sr-only"
              value={activeColor && /^#[\da-f]{6}$/i.test(activeColor) ? activeColor : "#000000"}
              onChange={(event) => applyColor(event.target.value, false)}
            />
          </div>
          <div className="border-t border-subtle-1" />
          <p className="px-1 text-12 font-medium text-secondary">{t("editor_comparison.defaultColors")}</p>
          {swatches(DEFAULT_COLORS)}
          {activeColor && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              stretch="full"
              label={clearLabel}
              icon={<EraserIcon className="size-4" />}
              onClick={() => {
                if (selection.current) {
                  editor.tf.select(selection.current);
                  editor.tf.removeMarks(mark);
                }
                setOpen(false);
              }}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
