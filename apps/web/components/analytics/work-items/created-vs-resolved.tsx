/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { CHART_SERIES_COLORS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { AreaChart } from "@plane/blocks/charts/area-chart";
import type { IChartResponse } from "@plane/types";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AsyncContent } from "@/components/common/async-content";
import { AnalyticsService } from "@/services/analytics.service";
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import AnalyticsRequestError from "../request-error";
import AnalyticsEmptyState from "../empty-state";
import { ChartLoader } from "../loaders";

const service = new AnalyticsService();
const CreatedVsResolved = observer(function CreatedVsResolved({ dashboard = false }: { dashboard?: boolean }) {
  const { selectedDuration, selectedProjects, selectedCycle, selectedModule, isPeekView, isEpic } = useAnalytics();
  const { workspaceSlug } = useParams();
  const { t, currentLocale } = useTranslation();
  const slug = String(workspaceSlug);
  const { data, isLoading, error, mutate } = useSWR(
    [
      "created-vs-resolved",
      slug,
      selectedDuration,
      selectedProjects.join(","),
      selectedCycle,
      selectedModule,
      isPeekView,
      isEpic,
    ],
    () =>
      service.getAdvanceAnalyticsCharts<IChartResponse>(
        slug,
        "work-items",
        {
          ...(selectedDuration && selectedDuration !== "all_time" ? { date_filter: selectedDuration } : {}),
          ...(selectedProjects.length ? { project_ids: selectedProjects.join(",") } : {}),
          ...(selectedCycle ? { cycle_id: selectedCycle } : {}),
          ...(selectedModule ? { module_id: selectedModule } : {}),
          ...(isEpic ? { epic: true } : {}),
        },
        isPeekView
      )
  );
  const parsed = useMemo(
    () =>
      data?.data.map((item) => ({
        ...item,
        name: new Intl.DateTimeFormat(currentLocale, { year: "numeric", month: "short" }).format(
          new Date(String(item.key) + "T00:00:00")
        ),
      })) ?? [],
    [data, currentLocale]
  );
  const areas = useMemo(
    () => [
      {
        key: "created_issues",
        label: t("web.created"),
        fill: CHART_SERIES_COLORS[0],
        fillOpacity: 0.06,
        stackId: "created",
        showDot: parsed.length === 1,
        smoothCurves: true,
        strokeColor: CHART_SERIES_COLORS[0],
        strokeOpacity: 1,
      },
      {
        key: "completed_issues",
        label: t("web.resolved"),
        fill: CHART_SERIES_COLORS[1],
        fillOpacity: 0.04,
        stackId: "completed",
        showDot: parsed.length === 1,
        smoothCurves: true,
        strokeColor: CHART_SERIES_COLORS[1],
        strokeOpacity: 1,
      },
    ],
    [t, parsed.length]
  );
  return (
    <AnalyticsSectionWrapper
      title={t("workspace_analytics.created_vs_resolved")}
      className={dashboard ? "h-full" : undefined}
      actions={<span className="ml-auto text-11 text-tertiary">{t("workspace_analytics.dashboard.monthly")}</span>}
    >
      {error ? (
        <AnalyticsRequestError onRetry={() => void mutate()} />
      ) : (
        <AsyncContent
          loading={isLoading}
          minHeight={dashboard ? 220 : 260}
          skeleton={<ChartLoader height={dashboard ? 220 : 260} />}
        >
          {parsed.length ? (
            <AreaChart
              className={dashboard ? "h-[220px] w-full" : "h-[260px] w-full"}
              data={parsed}
              areas={areas}
              margin={{ top: 12, bottom: 20, left: 0, right: 12 }}
              xAxis={{ key: "name", label: "" }}
              yAxis={{ key: "count", label: "" }}
              legend={{ align: "left", verticalAlign: "bottom", layout: "horizontal" }}
            />
          ) : (
            <AnalyticsEmptyState
              title={t("common.no_data_available")}
              description={t("workspace_empty_state.analytics_work_items.title")}
            />
          )}
        </AsyncContent>
      )}
    </AnalyticsSectionWrapper>
  );
});
export default CreatedVsResolved;
