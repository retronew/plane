/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";

import { SearchOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { IconColorPanel } from "./color-panel";
import { LucideIconsList } from "./lucide-root";
import { MaterialIconList } from "./material-root";

type IconRootProps = {
  onChange: (value: { name: string; color: string; background_color?: string }) => void;
  defaultColor: string;
  defaultBackground?: string;
  onBackgroundChange?: (background: string | undefined) => void;
  searchPlaceholder?: string;
  searchDisabled?: boolean;
  iconType: "material" | "lucide";
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
};

export function IconRoot(props: IconRootProps) {
  const {
    defaultColor,
    defaultBackground,
    onBackgroundChange,
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
  const [appliedDefaultColor, setAppliedDefaultColor] = useState(defaultColor);
  if (defaultColor !== appliedDefaultColor) {
    setAppliedDefaultColor(defaultColor);
    setActiveColor(defaultColor);
  }
  // use shared search query from parent
  const query = searchQuery ?? "";
  const [background, setBackground] = useState(defaultBackground);
  const [appliedBackground, setAppliedBackground] = useState(defaultBackground);
  if (defaultBackground !== appliedBackground) {
    setAppliedBackground(defaultBackground);
    setBackground(defaultBackground);
  }
  const selectIcon = (icon: { name: string; color: string }) => onChange({ ...icon, background_color: background });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col border-b border-subtle bg-layer-2">
        <IconColorPanel color={activeColor} onChange={setActiveColor} />
        <button
          type="button"
          className="self-end px-4 pb-2 text-12 text-secondary hover:text-primary"
          onClick={() => {
            const next = background === "transparent" ? undefined : "transparent";
            setBackground(next);
            onBackgroundChange?.(next);
          }}
        >
          {t(background === "transparent" ? "web.icon_background_auto" : "web.icon_background_clear")}
        </button>
        {!searchDisabled && (
          <div className="flex h-9 items-center gap-2 border-t border-subtle px-3 transition-colors duration-150 ease-out focus-within:bg-layer-transparent-hover motion-reduce:transition-none">
            <SearchOutline aria-hidden="true" className="size-3.5 shrink-0 text-placeholder" />
            <input
              type="search"
              placeholder={searchLabel}
              aria-label={searchLabel}
              value={query}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-13 text-primary outline-none placeholder:text-placeholder"
            />
          </div>
        )}
      </div>
      <div
        key={query}
        data-icon-picker-scrollport=""
        data-background-disabled={background === "transparent" ? "" : undefined}
        className="vertical-scrollbar min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain p-2"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(1.75rem,1fr))] justify-items-center gap-1">
          {iconType === "material" ? (
            <MaterialIconList query={query} onChange={selectIcon} activeColor={activeColor} />
          ) : (
            <LucideIconsList query={query} onChange={selectIcon} activeColor={activeColor} />
          )}
        </div>
      </div>
    </div>
  );
}
