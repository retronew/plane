import { AnalyticsMetricCard } from "./metric-card";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import type { IInsightField } from "@plane/constants";
import { ANALYTICS_INSIGHTS_FIELDS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/blocks/skeleton";
import type { IAnalyticsResponse, TAnalyticsTabsBase } from "@plane/types";
import { cn } from "@plane/utils";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AnalyticsService } from "@/services/analytics.service";
import { AsyncContent } from "@/components/common/async-content";
import AnalyticsRequestError from "./request-error";
import InsightCard from "./insight-card";

const service = new AnalyticsService();
const targets: Record<string, string> = {
  total_work_items: "work-items",
  total_projects: "projects",
  total_cycles: "cycles",
  total_intake: "intake",
};
const getInsightLabel = (
  type: TAnalyticsTabsBase,
  item: IInsightField,
  isEpic: boolean | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
) =>
  type === "work-items"
    ? t(item.i18nKey, { entity: t(isEpic ? "common.epics" : "common.work_items") })
    : t(item.i18nKey, {
        ...item.i18nProps,
        entity:
          item.key === "total_intake"
            ? t("workspace_analytics.details.tabs.intake")
            : item.i18nProps?.entity && t(item.i18nProps.entity),
      });
const TotalInsights = observer(function TotalInsights({
  analyticsType,
  peekView,
}: {
  analyticsType: TAnalyticsTabsBase;
  peekView?: boolean;
}) {
  const { workspaceSlug } = useParams();
  const slug = String(workspaceSlug);
  const { t } = useTranslation();
  const { selectedDuration, selectedProjects, selectedCycle, selectedModule, isPeekView, isEpic } = useAnalytics();
  const { data, isLoading, error, mutate } = useSWR(
    [
      "total-insights",
      slug,
      analyticsType,
      selectedDuration,
      selectedProjects.join(","),
      selectedCycle,
      selectedModule,
      isPeekView,
      isEpic,
    ],
    () =>
      service.getAdvanceAnalytics<IAnalyticsResponse>(
        slug,
        analyticsType,
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
  const dashboard = analyticsType === "overview";
  const fields = dashboard
    ? [
        "total_work_items",
        "total_projects",
        "total_cycles",
        "total_intake",
        "total_users",
        "total_admins",
        "total_members",
        "total_guests",
      ].map((key) => ANALYTICS_INSIGHTS_FIELDS.overview.find((f) => f.key === key)!)
    : ANALYTICS_INSIGHTS_FIELDS[analyticsType];
  if (error) return <AnalyticsRequestError onRetry={() => void mutate()} />;
  return (
    <AsyncContent
      loading={isLoading}
      minHeight={dashboard ? 155 : 90}
      skeleton={
        <Loader
          className={cn("-mx-2 grid grid-cols-2 gap-x-6 gap-y-5", dashboard ? "lg:grid-cols-4" : "lg:grid-cols-5")}
        >
          {fields.map((f) => (
            <div key={f.key} className="space-y-2 px-2 py-1.5">
              <Loader.Item width="90px" height="14px" />
              <Loader.Item width="42px" height="28px" />
            </div>
          ))}
        </Loader>
      }
    >
      <div
        className={cn(
          "-mx-2 grid grid-cols-2 gap-x-6 gap-y-5",
          dashboard ? "lg:grid-cols-4" : peekView ? "grid-cols-2" : "lg:grid-cols-5"
        )}
      >
        {fields.map((field) => {
          const label = getInsightLabel(analyticsType, field, isEpic, t);
          if (!dashboard && isPeekView)
            return (
              <div key={field.key} className="px-2 py-1.5">
                <InsightCard label={label} data={data?.[field.key]} />
              </div>
            );
          return (
            <AnalyticsMetricCard
              key={field.key}
              label={label}
              count={data?.[field.key]?.count ?? 0}
              to={dashboard ? `/${slug}/analytics/${targets[field.key] ?? "users"}/` : "#work-item-breakdown"}
              hint={
                dashboard
                  ? t("workspace_analytics.dashboard.open_details", {
                      entity:
                        field.key === "total_work_items"
                          ? t("common.work_items")
                          : t(`workspace_analytics.details.tabs.${targets[field.key] ?? "users"}`),
                    })
                  : t(`workspace_analytics.work_item_summary_hints.${field.key}`)
              }
            />
          );
        })}
      </div>
    </AsyncContent>
  );
});
export default TotalInsights;
