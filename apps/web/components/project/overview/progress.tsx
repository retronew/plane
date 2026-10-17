/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId, useMemo } from "react";
import useSWR from "swr";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { StateGroupIcon } from "@plane/blocks/icons";
import { STATE_GROUPS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
import type { TChart, TStateGroups } from "@plane/types";
import AnalyticsRequestError from "@/components/analytics/request-error";
import { AnalyticsService } from "@/services/analytics.service";

const analyticsService = new AnalyticsService();
const stateGroups = ["backlog", "unstarted", "started", "completed", "cancelled"] as const;
const stateLabels = {
  backlog: "web.backlog",
  unstarted: "web.unstarted",
  started: "web.started",
  completed: "web.completed",
  cancelled: "web.canceled",
} as const;

// build_analytics_chart returns { data: [{ key, name, count }], schema: {} }
// without group_by. The state group is the row's key; schema is not a count map.
function parseStateCounts(chart: TChart): Record<TStateGroups, number> {
  const counts = { backlog: 0, unstarted: 0, started: 0, completed: 0, cancelled: 0 };
  if (!Array.isArray(chart?.data)) throw new Error("Invalid project progress response");
  for (const row of chart.data) {
    if (!row || !stateGroups.some((group) => group === row.key) || !Number.isSafeInteger(row.count) || row.count < 0) {
      throw new Error("Invalid project progress response");
    }
    counts[row.key as TStateGroups] += row.count;
  }
  return counts;
}

export function ProjectOverviewProgress({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  const { t, currentLocale } = useTranslation();
  const headingId = useId();
  const { data, error, isLoading, mutate } = useSWR(
    ["project-overview-progress", workspaceSlug, projectId],
    async () => {
      try {
        const chart = await analyticsService.getAdvanceAnalyticsCharts<TChart>(
          workspaceSlug,
          "custom-work-items",
          {
            project_ids: projectId,
            x_axis: ChartXAxisProperty.STATE_GROUPS,
            y_axis: ChartYAxisMetric.WORK_ITEM_COUNT,
          },
          true
        );
        return parseStateCounts(chart);
      } catch (requestError) {
        // APIService may reject with an undefined response body for network errors.
        throw requestError instanceof Error ? requestError : new Error("Unable to load project progress");
      }
    }
  );
  const total = data ? stateGroups.reduce((sum, group) => sum + data[group], 0) : 0;
  const numberFormat = useMemo(() => new Intl.NumberFormat(currentLocale), [currentLocale]);
  const percentFormat = useMemo(
    () => new Intl.NumberFormat(currentLocale, { style: "percent", maximumFractionDigits: 0 }),
    [currentLocale]
  );
  const groups = stateGroups.map((key) => {
    const count = data?.[key] ?? 0;
    const percentage = percentFormat.format(total > 0 ? count / total : 0);
    const label = t(stateLabels[key]);
    return { key, count, percentage, label, description: `${label} · ${numberFormat.format(count)} · ${percentage}` };
  });

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-16 font-medium text-primary">
        {t("common.progress")}
      </h2>
      {error ? (
        <AnalyticsRequestError onRetry={() => void mutate()} />
      ) : isLoading || !data ? (
        <output aria-label={t("loading")} className="block space-y-4" aria-busy="true">
          <span className="block h-3.5 animate-pulse rounded bg-layer-2" />
          <span className="block h-12 animate-pulse rounded bg-layer-2" />
          <span className="sr-only">{t("loading")}</span>
        </output>
      ) : (
        <>
          {total > 0 ? (
            <figure aria-label={t("common.progress")} className="flex h-6 items-center gap-0.5">
              {groups
                .filter(({ count }) => count > 0)
                .map(({ key, count, description }) => (
                  <Tooltip key={key} label={description} side="top">
                    <button
                      type="button"
                      aria-label={description}
                      className="group focus-visible:outline-primary flex h-6 min-w-0 basis-0 cursor-default items-center rounded-sm p-0 focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ flexGrow: count }}
                    >
                      <span
                        aria-hidden="true"
                        className="block h-3.5 w-full rounded-sm group-hover:brightness-110 group-focus-visible:brightness-110"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${STATE_GROUPS[key].color} 35%, var(--bg-surface-1))`,
                        }}
                      />
                    </button>
                  </Tooltip>
                ))}
            </figure>
          ) : (
            <output className="block text-body-xs-regular text-tertiary">{t("common.no_data_available")}</output>
          )}
          <dl aria-label={t("common.state_groups")} className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
            {groups.map(({ key, count, percentage, label }) => (
              <div key={key} className="min-w-0 space-y-1">
                <dt className="flex items-center gap-1.5 text-body-xs-regular text-secondary">
                  <span aria-hidden="true">
                    <StateGroupIcon stateGroup={key} color={STATE_GROUPS[key].color} size="sm" />
                  </span>
                  <span className="break-words">{label}</span>
                </dt>
                <dd className="flex flex-wrap items-baseline gap-x-1.5 text-body-xs-regular tabular-nums">
                  <span className="font-medium text-primary">{numberFormat.format(count)}</span>
                  <span className="text-tertiary">{percentage}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
