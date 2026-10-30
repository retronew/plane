/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Timer } from "lucide-react";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { cn, formatCompactDate, getDate } from "@plane/utils";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const UNITS: [number, string][] = [
  [YEAR, "y"],
  [MONTH, "mo"],
  [WEEK, "w"],
  [DAY, "d"],
  [HOUR, "h"],
  [MINUTE, "m"],
];

/** Compact elapsed time in its largest whole unit — "<1m", "45m", "7h", "3d", "2w", "5mo", "1y". */
export function formatTimeInStatus(since: Date, now: Date = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - since.getTime());
  for (const [size, unit] of UNITS) {
    if (elapsed >= size) return `${Math.floor(elapsed / size)}${unit}`;
  }
  return "<1m";
}

type Props = {
  issue: Pick<TIssue, "state_changed_at" | "started_at">;
  stateName: string | undefined;
  chipClassName: string;
  isMobile: boolean;
};

/**
 * How long the work item has sat in its current state, recorded when the state changes — the
 * automatic counterpart of the planned start date. The tooltip names the state and, once work has
 * begun, when it started.
 */
export function TimeInStatusProperty({ issue, stateName, chipClassName, isMobile }: Props) {
  const { t } = useTranslation();
  const since = getDate(issue.state_changed_at);
  if (!since) return null;

  const startedAt = getDate(issue.started_at);
  const duration = formatTimeInStatus(since);
  const label = [
    `${t("issue.display.properties.time_in_status")}: ${stateName ? `${stateName} · ` : ""}${duration}`,
    startedAt ? t("issue.display.properties.started_at", { date: formatCompactDate(startedAt) }) : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Tooltip label={label} layout="stacked" disabled={isMobile}>
      {/* read-only: a click on the chip neither opens the work item nor does anything else */}
      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
      <div
        className={cn(chipClassName, "flex-shrink-0 cursor-default text-secondary")}
        data-testid="time-in-status"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <Timer className="h-3 w-3 flex-shrink-0" />
        <span>{duration}</span>
      </div>
    </Tooltip>
  );
}
