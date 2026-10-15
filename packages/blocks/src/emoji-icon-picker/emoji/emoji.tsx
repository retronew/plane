/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { InputGroup } from "@makeplane/propel/components/input";
import { SearchOutline } from "@makeplane/propel/icons";
import { getEmojiLocale } from "./locale";
import { useEffect, useRef } from "react";
import { EmojiPicker } from "frimousse";
import type { EmojiPickerListCategoryHeaderProps, EmojiPickerListRowProps, EmojiPickerListEmojiProps } from "frimousse";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";

type EmojiRootProps = {
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  searchDisabled?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
};

const emojiListComponents = {
  CategoryHeader: ({ category, ...props }: EmojiPickerListCategoryHeaderProps) => (
    // frimousse renders headers sticky inside the scrolling viewport, so they need an
    // opaque background or rows scroll visibly underneath the label text.
    <div
      data-slot="emoji-picker-list-category-header"
      className="bg-layer-2 px-3 pb-1.5 text-caption-sm-medium text-tertiary"
      {...props}
    >
      {category.label}
    </div>
  ),
  Row: ({ children, ...props }: EmojiPickerListRowProps) => (
    <div data-slot="emoji-picker-list-row" className="scroll-my-1.5 px-1.5" {...props}>
      {children}
    </div>
  ),
  Emoji: ({ emoji, ...props }: EmojiPickerListEmojiProps) => (
    <button
      type="button"
      aria-label={emoji?.label ?? emoji?.emoji}
      data-slot="emoji-picker-list-emoji"
      className="data-active:bg-accent flex size-8 items-center justify-center rounded-md text-20"
      {...props}
    >
      {emoji.emoji}
    </button>
  ),
};

export function EmojiRoot(props: EmojiRootProps) {
  const { onChange, searchPlaceholder, searchDisabled = false, searchQuery, onSearchQueryChange } = props;
  const { t, currentLocale } = useTranslation();
  const searchLabel = searchPlaceholder ?? t("common.search.label");
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (searchDisabled) return;
    const focusInput = () => {
      const searchWrapper = searchWrapperRef.current;
      if (searchWrapper) {
        const inputElement = searchWrapper.querySelector("input");
        if (inputElement) {
          inputElement.focus();
        }
      }
    };
    focusInput();
  }, [searchDisabled]);

  return (
    <EmojiPicker.Root
      locale={getEmojiLocale(currentLocale)}
      columns={9}
      data-slot="emoji-picker"
      className="isolate flex h-full w-full flex-col rounded-md border-none"
      onEmojiSelect={(val) => onChange(val.emoji)}
    >
      <div className="z-10 flex shrink-0 items-center gap-2 px-3 py-2">
        <div ref={searchWrapperRef} data-slot="emoji-picker-search-wrapper" className="min-w-0 flex-1">
          <InputGroup size="lg">
            <SearchOutline className="size-3.5 shrink-0 text-placeholder" />
            <EmojiPicker.Search
              placeholder={searchLabel}
              aria-label={searchLabel}
              disabled={searchDisabled}
              value={searchQuery ?? ""}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              className="h-5 min-w-0 flex-1 bg-transparent text-13 leading-5 text-primary outline-none placeholder:text-placeholder"
            />
          </InputGroup>
        </div>
        <EmojiPicker.SkinToneSelector
          data-slot="emoji-picker-skin-tone-selector"
          aria-label={t("web.change_skin_tone")}
          className="size-8 shrink-0 rounded-md text-18 hover:bg-layer-transparent-hover"
        />
      </div>
      <EmojiPicker.Viewport
        data-slot="emoji-picker-content"
        className={cn("relative min-h-0 flex-1 overflow-y-auto outline-none")}
      >
        <EmojiPicker.List
          data-slot="emoji-picker-list"
          className={cn("pb-2 select-none")}
          components={emojiListComponents}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
