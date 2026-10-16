/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SearchOutline } from "@makeplane/propel/icons";
import { getEmojiCategoryLabel, getEmojiLocale } from "./locale";
import { useEffect, useRef, useState } from "react";
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
  CategoryHeader: function CategoryHeader({ category, ...props }: EmojiPickerListCategoryHeaderProps) {
    const { currentLocale } = useTranslation();
    return (
      <div
        {...props}
        data-slot="emoji-picker-list-category-header"
        className="bg-layer-2 px-3 py-1.5 text-caption-sm-medium text-tertiary"
      >
        {getEmojiCategoryLabel(category.label, currentLocale)}
      </div>
    );
  },
  Row: ({ children, style, ...props }: EmojiPickerListRowProps) => (
    <div
      data-slot="emoji-picker-list-row"
      className="scroll-my-1.5 px-1.5"
      {...props}
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: "repeat(var(--frimousse-list-columns), minmax(0, 1fr))",
        justifyItems: "center",
      }}
    >
      {children}
    </div>
  ),
  Emoji: ({ emoji, ...props }: EmojiPickerListEmojiProps) => (
    <button
      type="button"
      aria-label={emoji?.label ?? emoji?.emoji}
      data-slot="emoji-picker-list-emoji"
      className="data-active:bg-accent flex size-7 items-center justify-center rounded-md text-20"
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
  const [columns, setColumns] = useState(14);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => setColumns(Math.max(1, Math.floor((root.clientWidth - 16) / 28))));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
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
      columns={columns}
      ref={rootRef}
      data-slot="emoji-picker"
      className="isolate flex h-full w-full flex-col rounded-md border-none"
      onEmojiSelect={(val) => onChange(val.emoji)}
    >
      <div className="z-10 flex h-9 shrink-0 items-center gap-2 border-y border-subtle px-3 transition-colors duration-150 ease-out focus-within:bg-layer-transparent-hover motion-reduce:transition-none">
        <div
          ref={searchWrapperRef}
          data-slot="emoji-picker-search-wrapper"
          className="flex h-full min-w-0 flex-1 items-center gap-2"
        >
          <SearchOutline className="size-3.5 shrink-0 text-placeholder" />
          <EmojiPicker.Search
            placeholder={searchLabel}
            aria-label={searchLabel}
            disabled={searchDisabled}
            value={searchQuery ?? ""}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            className="h-5 min-w-0 flex-1 bg-transparent text-13 leading-5 text-primary outline-none placeholder:text-placeholder"
          />
        </div>
        <EmojiPicker.SkinToneSelector
          data-slot="emoji-picker-skin-tone-selector"
          aria-label={t("web.change_skin_tone")}
          className="grid size-6 shrink-0 place-items-center rounded-md p-0 text-16 leading-none hover:bg-layer-transparent-hover"
        />
      </div>
      <EmojiPicker.Viewport
        data-slot="emoji-picker-content"
        className={cn("vertical-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none")}
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
