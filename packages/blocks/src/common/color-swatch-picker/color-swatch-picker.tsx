/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { HexColorPicker } from "react-colorful";
import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";

import { DEFAULT_SWATCH_COLORS } from "./default-swatches";
import { normalizeHex, parseHexColor } from "./hex";

export type ColorSwatchPickerLabels = {
  /** Accessible name of the swatch group. */
  swatches: string;
  /** Accessible name of the hex field. */
  hexInput: string;
};

export type ColorSwatchPickerProps = {
  continuous?: boolean;
  /** Reset an already selected swatch without changing other color input behavior. */
  onClear?: () => void;
  /** The current colour as a hex string (with or without the leading `#`). */
  value?: string;
  /** Optional layout width for wider settings palettes. */
  className?: string;
  /** The preset swatches. @default DEFAULT_SWATCH_COLORS */
  colors?: readonly string[];
  /** Fires with a normalised `#rrggbb` when a swatch is picked or a complete hex is typed. */
  onChange: (hex: string) => void;
  /** Accessible names. The caller passes translated strings. */
  labels?: Partial<ColorSwatchPickerLabels>;
};

/**
 * A preset-swatch colour picker with a hex field — the shape of the old Twitter-style swatch picker,
 * on propel tokens. Picking a swatch fires `onChange` at once; the hex field fires as soon as the draft
 * is a colour (three or six hex characters, expanded to `#rrggbb`) and snaps back to the current value
 * on blur when what was typed is not one. It draws no popup or pointer of its own: put it inside a
 * Propel `Popover` (or inline in a form) and let that own the surface.
 */
export function ColorSwatchPicker(props: ColorSwatchPickerProps) {
  const {
    value = "",
    colors = DEFAULT_SWATCH_COLORS,
    onChange,
    onClear,
    labels,
    className,
    continuous = false,
  } = props;
  // plane hooks
  const { t } = useTranslation();
  const swatchesLabel = labels?.swatches ?? t("aria_labels.color_picker.swatches");
  const hexLabel = labels?.hexInput ?? t("aria_labels.color_picker.hex_input");
  // ids
  const hexInputId = useId();
  const [customOpen, setCustomOpen] = useState(false);
  const gradientRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!continuous) return;
    gradientRef.current
      ?.querySelector(".react-colorful__saturation [role=slider]")
      ?.setAttribute("aria-label", t("web.icon_color.saturation"));
    gradientRef.current
      ?.querySelector(".react-colorful__hue [role=slider]")
      ?.setAttribute("aria-label", t("web.icon_color.hue"));
  }, [continuous, t]);
  // ref
  const isFieldFocused = useRef(false);
  // derived values
  const selected = normalizeHex(value).toLowerCase();
  // local state: what the user is typing, seeded from the value and re-seeded whenever it changes
  const [draft, setDraft] = useState(() => selected.replace(/^#/, ""));
  useEffect(() => {
    // Never re-seed under the cursor: the echo of a just-committed value would lowercase what the user
    // is typing and drop the caret to the end. The blur handler puts the field back in sync instead.
    if (isFieldFocused.current) return;
    setDraft(selected.replace(/^#/, ""));
  }, [selected]);

  // handlers
  const handleDraftChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.replace(/^#/, "").slice(0, 6);
    setDraft(next);
    const hex = parseHexColor(next);
    if (hex) onChange(hex);
  };
  const handleDraftFocus = () => {
    isFieldFocused.current = true;
  };
  const handleDraftBlur = (event: FocusEvent<HTMLInputElement>) => {
    isFieldFocused.current = false;
    const hex = parseHexColor(event.target.value);
    // Not a colour: snap back to the current value. A colour: keep it, expanded — a three-digit draft
    // is committed here rather than thrown away.
    if (!hex) {
      setDraft(selected.replace(/^#/, ""));
      return;
    }
    setDraft(hex.replace(/^#/, ""));
    if (hex !== selected) onChange(hex);
  };

  return (
    <div className={cn("flex w-56 max-w-full flex-col gap-3", className)}>
      <fieldset aria-label={swatchesLabel} className={cn("flex gap-2", continuous ? "flex-nowrap" : "flex-wrap")}>
        {colors.map((color) => {
          const hex = normalizeHex(color).toLowerCase();
          const isSelected = hex === selected;
          return (
            <button
              key={color}
              type="button"
              aria-label={hex}
              aria-pressed={isSelected}
              onClick={() => (isSelected && onClear ? onClear() : onChange(hex))}
              className={cn(
                "shrink-0 cursor-pointer rounded-md transition-transform outline-none",
                continuous ? "size-5" : "size-7",
                "hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1",
                isSelected && "ring-2 ring-accent-strong ring-offset-1"
              )}
              style={{ backgroundColor: hex }}
            />
          );
        })}
        {continuous && (
          <button
            type="button"
            aria-label={t(customOpen ? "web.icon_color.presets" : "web.icon_color.custom")}
            aria-pressed={customOpen}
            onClick={() => setCustomOpen(!customOpen)}
            className={cn(
              "ml-auto size-5 shrink-0 rounded-md outline-none conical-gradient focus-visible:ring-2 focus-visible:ring-accent-strong",
              customOpen && "ring-2 ring-accent-strong ring-offset-1"
            )}
          />
        )}
      </fieldset>
      {continuous && (
        <div
          data-color-mode-drawer=""
          data-open={customOpen ? "" : undefined}
          aria-hidden={!customOpen}
          inert={!customOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div data-continuous-color-picker="" ref={gradientRef}>
              <HexColorPicker color={selected || "#60646c"} onChange={onChange} />
            </div>
          </div>
        </div>
      )}
      {/* propel: the bare Input is transparent; InputGroup draws the box around the "#" prefix and the field. */}
      <InputGroup size={continuous ? "md" : "lg"}>
        <span aria-hidden="true" className="ps-2 text-body-sm-regular text-tertiary select-none">
          #
        </span>
        <Input
          id={hexInputId}
          size={continuous ? "md" : "lg"}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          /* 7, not 6: the UA enforces this before React sees the value, so a pasted `#rrggbb` has to fit
             whole for the handler's `#`-strip to leave a full six characters. */
          maxLength={7}
          aria-label={hexLabel}
          value={draft}
          onChange={handleDraftChange}
          onFocus={handleDraftFocus}
          onBlur={handleDraftBlur}
        />
      </InputGroup>
    </div>
  );
}
