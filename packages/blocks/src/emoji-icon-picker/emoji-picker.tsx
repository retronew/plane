/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useCallback, useState } from "react";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Tab, Tabs, TabsList, TabsPanel } from "@makeplane/propel/components/tabs";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import type { Placement, Side, Align } from "../utils/placement";
import { convertPlacementToSideAndAlign } from "../utils/placement";
import { EmojiRoot } from "./emoji/emoji";
import type { ChangeHandlerPayload, EmojiIconPickerType } from "./helper";
import { emojiToString } from "./helper";
import { IconRoot } from "./icon/icon-root";

export type EmojiPickerProps = {
  isOpen: boolean;
  handleToggle: (value: boolean) => void;
  buttonClassName?: string;
  className?: string;
  closeOnSelect?: boolean;
  defaultIconColor?: string;
  defaultOpen?: EmojiIconPickerType;
  disabled?: boolean;
  dropdownClassName?: string;
  label: React.ReactNode;
  onChange: (value: ChangeHandlerPayload) => void;
  placement?: Placement;
  searchDisabled?: boolean;
  searchPlaceholder?: string;
  iconType?: "material" | "lucide";
  theme?: "light" | "dark";
  side?: Side;
  align?: Align;
  showEmojiTab?: boolean;
};

export function EmojiPicker(props: EmojiPickerProps) {
  const {
    isOpen,
    handleToggle,
    buttonClassName,
    closeOnSelect = true,
    defaultIconColor = "#6d7b8a",
    defaultOpen = "emoji",
    disabled = false,
    dropdownClassName,
    label,
    onChange,
    placement = "bottom-start",
    searchDisabled = false,
    searchPlaceholder,
    iconType = "lucide",
    side = "bottom",
    align = "start",
    showEmojiTab = true,
  } = props;
  // plane hooks
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("common.search.label");

  const { finalSide, finalAlign } = useMemo(() => {
    if (placement) {
      const converted = convertPlacementToSideAndAlign(placement);
      return { finalSide: converted.side, finalAlign: converted.align };
    }
    return { finalSide: side, finalAlign: align };
  }, [placement, side, align]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) setSearchQuery("");
      handleToggle(value);
    },
    [handleToggle]
  );

  const handleEmojiChange = useCallback(
    (value: string) => {
      onChange({
        type: "emoji",
        value: emojiToString(value),
      });
      if (closeOnSelect) handleOpenChange(false);
    },
    [onChange, closeOnSelect, handleOpenChange]
  );

  const handleIconChange = useCallback(
    (value: { name: string; color: string }) => {
      onChange({
        type: "icon",
        value,
      });
      if (closeOnSelect) handleOpenChange(false);
    },
    [onChange, closeOnSelect, handleOpenChange]
  );

  const tabs = useMemo(
    () =>
      [
        showEmojiTab
          ? {
              key: "emoji",
              label: t("web.emoji"),
              content: (
                <EmojiRoot
                  onChange={handleEmojiChange}
                  searchPlaceholder={resolvedSearchPlaceholder}
                  searchDisabled={searchDisabled}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                />
              ),
            }
          : null,
        {
          key: "icon",
          label: t("web.icon"),
          content: (
            <IconRoot
              defaultColor={defaultIconColor}
              onChange={handleIconChange}
              searchPlaceholder={resolvedSearchPlaceholder}
              searchDisabled={searchDisabled}
              iconType={iconType}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          ),
        },
      ].filter((tab): tab is NonNullable<typeof tab> => !!tab),
    [
      t,
      defaultIconColor,
      searchDisabled,
      resolvedSearchPlaceholder,
      iconType,
      searchQuery,
      handleEmojiChange,
      handleIconChange,
      showEmojiTab,
    ]
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            aria-label={showEmojiTab ? `${t("web.emoji")} / ${t("web.icon")}` : t("web.icon")}
            className={cn("outline-none", buttonClassName)}
            disabled={disabled}
          />
        }
      >
        {label}
      </PopoverTrigger>
      <PopoverContent
        variant="rich"
        data-emoji-icon-picker-popup=""
        side={finalSide}
        align={finalAlign}
        sideOffset={8}
        data-prevent-outside-click="true"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            return;
          }
          if (e.key === "Escape") {
            handleOpenChange(false);
            return;
          }
          e.stopPropagation();
        }}
      >
        <div
          className={cn(
            "flex h-[438px] max-h-[calc(var(--available-height)-2px)] min-h-0 w-full flex-col",
            dropdownClassName
          )}
        >
          <Tabs
            data-emoji-picker-tabs=""
            variant="underline"
            layout="fill"
            defaultValue={showEmojiTab ? defaultOpen : "icon"}
          >
            {tabs.length > 1 && (
              <div className="w-full px-3 pt-2.5">
                <TabsList>
                  {tabs.map((tab) => (
                    <Tab key={tab.key} value={tab.key} label={tab.label} />
                  ))}
                </TabsList>
              </div>
            )}
            <PopoverBody data-emoji-picker-body="" tabIndex={0}>
              {tabs.map((tab) => (
                // The icon tab has no inner scrollport (unlike the emoji tab's frimousse
                // viewport), so the panel itself scrolls.
                <TabsPanel key={tab.key} value={tab.key}>
                  <div
                    className={cn(
                      "h-full min-h-0",
                      tab.key === "icon" ? "scrollbar-sm overflow-y-auto" : "overflow-hidden"
                    )}
                  >
                    {tab.content}
                  </div>
                </TabsPanel>
              ))}
            </PopoverBody>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}
