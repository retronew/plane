/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import type { TContextMenuItem, TContextMenuItemVariant } from "./types";

/** Rows whose `shouldRender` is explicitly `false` never reach the surface. */
export function getRenderableItems(items: TContextMenuItem[] | undefined): TContextMenuItem[] {
  return items?.filter((item) => item.shouldRender !== false) ?? [];
}

export function hasMenuSeparatorBefore(items: TContextMenuItem[], index: number): boolean {
  return index > 0 && items[index].section !== items[index - 1].section;
}

/**
 * The row's look. `variant` wins; failing that, a legacy `className` carrying a `text-danger` token
 * still resolves to `danger`, which is how the ~15 quick-action files currently paint their Delete
 * row. Drop this fallback once those call sites pass `variant` instead.
 */
export function resolveItemVariant(item: TContextMenuItem): TContextMenuItemVariant {
  if (item.variant) return item.variant;
  if (item.className?.includes("text-danger")) return "danger";
  return "neutral";
}

/** Rows whose title contains the query, case-insensitively; an empty query keeps every row. */
export function filterMenuItemsByQuery(items: TContextMenuItem[], query: string): TContextMenuItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => item.title?.toLowerCase().includes(needle));
}

/**
 * A disabled row's `description` explains why it is unavailable. Like Linear, the menu keeps such a
 * row to one compact line and moves the explanation into a hover tooltip instead of a second line.
 */
export function getDisabledReason(item: TContextMenuItem): string | undefined {
  return item.disabled && item.description ? item.description : undefined;
}

/**
 * The popup is portalled, but React events still bubble through the consumer's tree — a card `Link`
 * or `ControlLink` wrapping the menu would otherwise act on every click inside the surface.
 */
export function stopClickPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}
