/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { CreatedResolvedChart } from "./created-resolved-chart";
import type { IChartResponse } from "@plane/types";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AsyncContent } from "@/components/common/async-content";
import { AnalyticsService } from "@/services/analytics.service";
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import AnalyticsRequestError from "../request-error";
import AnalyticsEmptyState from "../empty-state";
import { ChartLoader } from "../loaders";

import { StatisticsNote, StatisticsNotePanel } from "../statistics-note";

const service = new AnalyticsService();
const CreatedVsResolved = observer(function CreatedVsResolved({ dashboard = false }: { dashboard?: boolean }) {
  const { selectedDuration, selectedProjects, selectedCycle, selectedModule, isPeekView, isEpic } = useAnalytics();
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
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
  return (
    <AnalyticsSectionWrapper
      titleClassName={dashboard ? "text-16" : undefined}
      title={t("workspace_analytics.created_vs_resolved")}
      className={dashboard ? "h-full" : undefined}
      actions={
        <span className="ml-auto text-11 text-tertiary">
          {t(
            data?.granularity === "day"
              ? "workspace_analytics.methodology.daily"
              : "workspace_analytics.dashboard.monthly"
          )}
        </span>
      }
    >
      {error ? (
        <AnalyticsRequestError onRetry={() => void mutate()} />
      ) : (
        <AsyncContent
          loading={isLoading}
          minHeight={dashboard ? 220 : 260}
          skeleton={<ChartLoader height={dashboard ? 220 : 260} />}
        >
          {data?.data.length ? (
            <CreatedResolvedChart rows={data.data} granularity={data.granularity} height={dashboard ? 220 : 260} />
          ) : (
            <AnalyticsEmptyState
              title={t("common.no_data_available")}
              description={t("workspace_empty_state.analytics_work_items.title")}
            />
          )}
        </AsyncContent>
      )}
      <StatisticsNotePanel>
        {data?.period && (
          <p className="text-12 font-medium text-secondary">
            {t("workspace_analytics.methodology.range", data.period)}
          </p>
        )}
        <StatisticsNote kind="trend" />
      </StatisticsNotePanel>
    </AnalyticsSectionWrapper>
  );
});
export default CreatedVsResolved;
