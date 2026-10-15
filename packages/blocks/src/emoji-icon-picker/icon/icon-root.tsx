/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useId, useState } from "react";

import { Input, InputGroup } from "@makeplane/propel/components/input";
import { SearchOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import { adjustColorForContrast, DEFAULT_COLORS } from "../helper";
import { LucideIconsList } from "./lucide-root";
import { MaterialIconList } from "./material-root";

type IconRootProps = {
  onChange: (value: { name: string; color: string }) => void;
  defaultColor: string;
  searchPlaceholder?: string;
  searchDisabled?: boolean;
  iconType: "material" | "lucide";
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
};

const isPresetColor = (color: string) => DEFAULT_COLORS.includes(color.toLowerCase());

export function IconRoot(props: IconRootProps) {
  const {
    defaultColor,
    onChange,
    searchPlaceholder,
    searchDisabled = false,
    iconType,
    searchQuery,
    onSearchQueryChange,
  } = props;
  const { t } = useTranslation();
  const searchLabel = searchPlaceholder ?? t("common.search.label");
  // states
  const [activeColor, setActiveColor] = useState(defaultColor);
  // A preset default shows the swatch row; any other colour opens the hex input pre-filled with it.
  const [showHexInput, setShowHexInput] = useState(() => !isPresetColor(defaultColor));
  const [hexValue, setHexValue] = useState(() => (isPresetColor(defaultColor) ? "" : defaultColor.slice(1, 7)));
  // Re-apply that rule when the caller passes a new default (guarded render update, not an effect)
  const [appliedDefaultColor, setAppliedDefaultColor] = useState(defaultColor);
  if (defaultColor !== appliedDefaultColor) {
    setAppliedDefaultColor(defaultColor);
    setActiveColor(defaultColor);
    if (isPresetColor(defaultColor)) setShowHexInput(false);
    else {
      setHexValue(defaultColor.slice(1, 7));
      setShowHexInput(true);
    }
  }
  const hexLabelId = useId();
  // use shared search query from parent
  const query = searchQuery ?? "";

  return (
    <>
      {/* Sticky inside the tab panel's scrollport — needs an opaque background or icons scroll underneath. */}
      <div className="sticky top-0 flex flex-col bg-layer-2">
        {!searchDisabled && (
          <div className="px-3 py-2">
            <InputGroup size="lg">
              <SearchOutline aria-hidden="true" className="size-3.5 shrink-0 text-placeholder" />
              <Input
                size="lg"
                placeholder={searchLabel}
                aria-label={searchLabel}
                value={query}
                onChange={(e) => onSearchQueryChange?.(e.target.value)}
              />
            </InputGroup>
          </div>
        )}
        <div className="grid h-8 grid-cols-9 items-center justify-items-center gap-0.5 px-2">
          {showHexInput ? (
            <div className="col-span-8 ml-2 flex items-center gap-1 justify-self-stretch">
              <span
                className="mr-1 h-4 w-4 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor: `#${hexValue}`,
                }}
              />
              <span id={hexLabelId} className="flex-shrink-0 text-caption-sm-regular text-tertiary">
                {t("web.hex")}
              </span>
              <span className="-mr-1 flex-shrink-0 text-caption-sm-regular text-secondary">#</span>
              <input
                type="text"
                aria-labelledby={hexLabelId}
                value={hexValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setHexValue(value);
                  if (/^[0-9A-Fa-f]{6}$/.test(value)) setActiveColor(adjustColorForContrast(`#${value}`));
                }}
                className="block flex-grow rounded-sm border-[0.5px] border-none border-subtle bg-transparent px-3 py-2 pl-0 text-caption-sm-regular text-secondary placeholder-(--text-color-placeholder) ring-0 focus:outline-none"
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus on open
                autoFocus
              />
            </div>
          ) : (
            DEFAULT_COLORS.map((curCol) => (
              <button
                key={curCol}
                type="button"
                aria-label={curCol}
                aria-pressed={activeColor.toLowerCase() === curCol.toLowerCase()}
                className="grid size-8 place-items-center rounded-md hover:bg-layer-transparent-hover"
                onClick={() => {
                  setActiveColor(curCol);
                  setHexValue(curCol.slice(1, 7));
                }}
              >
                <span className="h-4 w-4 cursor-pointer rounded-full" style={{ backgroundColor: curCol }} />
              </button>
            ))
          )}
          <button
            type="button"
            aria-label={t("aria_labels.color_picker.hex_input")}
            aria-pressed={showHexInput}
            className={cn(
              "grid size-8 place-items-center rounded-md border border-transparent hover:bg-layer-transparent-hover",
              {
                "border-strong-1": !showHexInput,
              }
            )}
            onClick={() => {
              setShowHexInput((prevData) => !prevData);
              setHexValue(activeColor.slice(1, 7));
            }}
          >
            {showHexInput ? (
              <span className="h-4 w-4 rounded-full conical-gradient" />
            ) : (
              <span className="grid place-items-center text-caption-xs-regular text-tertiary">#</span>
            )}
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-9 justify-items-center gap-0.5 px-2 pb-2">
        {iconType === "material" ? (
          <MaterialIconList query={query} onChange={onChange} activeColor={activeColor} />
        ) : (
          <LucideIconsList query={query} onChange={onChange} activeColor={activeColor} />
        )}
      </div>
    </>
  );
}
