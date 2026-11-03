/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Timer } from "lucide-react";
import { observer } from "mobx-react";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";
import type { TIssue, TStateGroups } from "@plane/types";
import { cn, formatCompactDate, getDate } from "@plane/utils";
import { useStatusDurationClock } from "@/hooks/use-status-duration-clock";
import { formatStateEntryTime, formatTimeInStatus } from "./status-duration";

type Props = {
  issue: Pick<TIssue, "state_changed_at" | "started_at">;
  stateName: string | undefined;
  stateGroup?: TStateGroups;
  chipClassName: string;
  isMobile: boolean;
};

/** Current-state duration is only meaningful for work that has not ended. */
export const TimeInStatusProperty = observer(function TimeInStatusProperty({
  issue,
  stateName,
  stateGroup,
  chipClassName,
  isMobile,
}: Props) {
  const { t, currentLocale } = useTranslation();
  const since = issue.state_changed_at ? new Date(issue.state_changed_at) : undefined;
  const active =
    stateGroup !== "completed" && stateGroup !== "cancelled" && !!since && Number.isFinite(since.getTime());
  const currentTime = useStatusDurationClock(active ? since?.getTime() : undefined);
  if (!active || !since) return null;

  const startedAt = getDate(issue.started_at);
  const duration = formatTimeInStatus(since, new Date(currentTime), currentLocale);
  const enteredAt = formatStateEntryTime(since, currentLocale);
  const label = [
    `${t("issue.display.properties.time_in_status")}: ${stateName ? `${stateName} · ` : ""}${duration}`,
    `${t("common.state")} · ${enteredAt}`,
    startedAt ? t("issue.display.properties.started_at", { date: formatCompactDate(startedAt) }) : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Tooltip label={label} layout="stacked" disabled={isMobile}>
      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
      <div
        className={cn(chipClassName, "max-w-full min-w-0 flex-shrink-0 cursor-default text-secondary")}
        data-testid="time-in-status"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <Timer className="h-3 w-3 flex-shrink-0" />
        <span className="truncate tabular-nums">{duration}</span>
      </div>
    </Tooltip>
  );
});
