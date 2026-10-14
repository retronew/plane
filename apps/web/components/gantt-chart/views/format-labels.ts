/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** Format calendar labels without changing the stable day/month identifiers used by the chart. */
export function formatGanttMonth(year: number, month: number, locale: string, includeYear = true): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(new Date(year, month, 1));
}

export function formatGanttWeekday(day: number, locale: string): string {
  // 2024-01-07 is a Sunday; noon avoids any midnight daylight-saving transition.
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 7 + day, 12));
}
