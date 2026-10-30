/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
// plane imports
import { useTranslation } from "@plane/i18n";
// local imports
import { filterMenuItemsByQuery } from "./helpers";
import type { TContextMenuItem } from "./types";

type SubmenuSearchListProps = {
  /** The submenu trigger row; its `searchPlaceholder` (or the title) labels the field. */
  item: TContextMenuItem;
  /** The renderable nested rows, before filtering. */
  items: TContextMenuItem[];
  /** Renders the rows that match the query — the context menu and the dropdown each bring their own row. */
  renderItems: (items: TContextMenuItem[]) => React.ReactNode;
};

/**
 * Linear-style filter field at the top of a `searchable` submenu. It mounts with the flyout and takes
 * focus straight away, so hovering a submenu and typing narrows the list.
 */
export function SubmenuSearchList(props: SubmenuSearchListProps) {
  const { item, items, renderItems } = props;
  // states
  const [query, setQuery] = useState("");
  // refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  // translation
  const { t } = useTranslation();
  // derived values
  const matches = filterMenuItemsByQuery(items, query);
  const placeholder = item.searchPlaceholder ?? item.title ?? "";

  // The field mounts with the flyout; focus it a frame later so the menu's own initial focus,
  // which lands in a later effect, does not take it back — then hover-and-type just works.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      {/* Linear-style header: no glyph, roomier padding, and a divider that bleeds past the popup's p-1 */}
      <div className="-mx-1 -mt-1 mb-1 border-b border-subtle px-3 py-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // keep typing out of the menu's typeahead; Escape still closes the submenu
            if (event.key !== "Escape") event.stopPropagation();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-transparent text-body-xs-regular text-primary outline-none placeholder:text-placeholder"
        />
      </div>
      {matches.length > 0 ? (
        renderItems(matches)
      ) : (
        <div className="px-2 py-1.5 text-body-xs-regular text-tertiary">{t("web.no_results_found")}</div>
      )}
    </>
  );
}
