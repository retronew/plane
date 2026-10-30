/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CircularProgress } from "@makeplane/propel/components/circular-progress";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";

export type TSubWorkItemProgress = { done: number; total: number; percent: number };

/** Completed vs. total sub-work items of a list row; `null` when it has none to report. */
export function getSubWorkItemProgress(
  issue: Pick<TIssue, "sub_issues_count" | "completed_sub_issues_count">
): TSubWorkItemProgress | null {
  const total = issue.sub_issues_count ?? 0;
  if (total <= 0) return null;
  const done = Math.min(Math.max(issue.completed_sub_issues_count ?? 0, 0), total);
  return { done, total, percent: Math.round((done / total) * 100) };
}

/** The card's sub-work item row: a progress ring with the done/total count, and the percentage. */
export function KanbanCardProgress({ progress }: { progress: TSubWorkItemProgress }) {
  const { t } = useTranslation();
  const isComplete = progress.done === progress.total;

  return (
    <div className="flex items-center justify-between gap-2 text-caption-md-medium text-tertiary">
      <span className="flex items-center gap-1.5">
        <CircularProgress
          value={progress.percent}
          size="sm"
          variant={isComplete ? "success" : "brand"}
          aria-label={t("common.sub_work_items")}
        />
        <span className="tabular-nums">
          {progress.done}/{progress.total}
        </span>
      </span>
      <span className="text-secondary tabular-nums">{progress.percent}%</span>
    </div>
  );
}
