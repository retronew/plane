import { useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { ChartXAxisProperty as Axis, ChartYAxisMetric } from "@plane/types";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { AnalyticsService } from "@/services/analytics.service";
import { InsightChart } from "./work-items/priority-chart";
import AnalyticsRequestError from "./request-error";
import { StatisticsNotePanel } from "./statistics-note";

import { buildEntityInsights, type EntityMetric } from "./entity-insights-data";
const service = new AnalyticsService();

export const EntityInsights = observer(function EntityInsights({
  metric,
  axis,
  group,
  dimensionLabel,
}: {
  metric: EntityMetric;
  axis: Axis;
  group?: Axis;
  dimensionLabel?: string;
}) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const slug = String(workspaceSlug);
  const { selectedProjects, selectedDuration } = useAnalytics();
  const { data, isLoading, error, mutate } = useSWR(
    ["analytics-details", slug, metric, selectedProjects.join(","), selectedDuration],
    () => service.getAnalyticsDetails(slug, metric, selectedProjects, selectedDuration),
    { errorRetryCount: 2 }
  );
  const chart = useMemo(
    () => buildEntityInsights(data?.rows ?? [], metric, axis, group, t),
    [data, metric, axis, group, t]
  );
  if (error) return <AnalyticsRequestError onRetry={() => void mutate()} />;
  return (
    <>
      <InsightChart
        key={`${metric}:${axis}:${group}`}
        data={chart}
        loading={isLoading}
        x_axis={axis}
        group_by={group}
        y_axis={ChartYAxisMetric.WORK_ITEM_COUNT}
        metricLabel={t(`workspace_analytics.insights.metrics.${metric}`)}
        dimensionLabel={dimensionLabel}
      />
      <StatisticsNotePanel>
        <p className="text-12 leading-relaxed text-tertiary">{t(`workspace_analytics.insights.scope.${metric}`)}</p>
      </StatisticsNotePanel>
    </>
  );
});
