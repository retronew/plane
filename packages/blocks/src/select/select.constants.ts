/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** One debounce for every server-side option search (paginated lists, menu sources). */
export const SELECT_SEARCH_DEBOUNCE_MS = 300;

/** Compact shared menu row (20px line box plus 4px vertical inset per side). */
export const MENU_ROW_HEIGHT = 28;

/** Estimated height of Select's standard option row, matching the shared menu density. */
export const SELECT_OPTION_ROW_HEIGHT = 28;

/** Bounded, scrollable option-list container inside a flyout panel. */
export const MENU_LIST_CLASSNAME = "max-h-48 overflow-y-auto vertical-scrollbar scrollbar-sm p-1";
