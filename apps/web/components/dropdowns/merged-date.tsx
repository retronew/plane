/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// helpers
import { formatDateRange, getDate, getDateLocale } from "@plane/utils";

type Props = {
  startDate: Date | string | null | undefined;
  endDate: Date | string | null | undefined;
  className?: string;
  compact?: boolean;
};

/**
 * Formats merged date range display with smart formatting
 * - Single date: "Jan 24, 2025"
 * - Same year, same month: "Jan 24 - 28, 2025"
 * - Same year, different month: "Jan 24 - Feb 6, 2025"
 * - Different year: "Dec 28, 2024 - Jan 4, 2025"
 */
const compactDateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatCompactCycleDateRange(start: Date | null | undefined, end: Date | null | undefined): string {
  if (!start || !end) return formatDateRange(start, end);
  const locale = getDateLocale();
  if (locale.startsWith("zh") && start.getFullYear() === end.getFullYear()) {
    const endMonth = start.getMonth() === end.getMonth() ? "" : `${end.getMonth() + 1}月`;
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日–${endMonth}${end.getDate()}日`;
  }
  let formatter = compactDateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
    compactDateFormatters.set(locale, formatter);
  }
  return formatter.formatRange(start, end);
}

export const MergedDateDisplay = observer(function MergedDateDisplay(props: Props) {
  const { startDate, endDate, className = "", compact = false } = props;

  // Parse dates
  const parsedStartDate = getDate(startDate);
  const parsedEndDate = getDate(endDate);

  const displayText = compact
    ? formatCompactCycleDateRange(parsedStartDate, parsedEndDate)
    : formatDateRange(parsedStartDate, parsedEndDate);

  if (!displayText) {
    return null;
  }

  return <span className={className}>{displayText}</span>;
});
