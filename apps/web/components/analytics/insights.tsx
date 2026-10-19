import { InsightOptionIcon } from "./insight-option-icon";
import { useState } from "react";
import { useTranslation } from "@plane/i18n";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
import { ANALYTICS_X_AXIS_VALUES } from "@plane/constants";
import AnalyticsWrapper from "./analytics-wrapper";
import { AnalyticsChoice } from "./choice";
import PriorityChart from "./work-items/priority-chart";
import { EntityInsights } from "./entity-insights";
import { ENTITY_AXES } from "./entity-insights-data";
import { INSIGHT_METRICS, type InsightMetric } from "./insight-metrics";

export function Insights() {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<InsightMetric>("work-items");
  const [axis, setAxis] = useState(ChartXAxisProperty.PRIORITY);
  const [group, setGroup] = useState("");
  const axes =
    metric === "work-items"
      ? ANALYTICS_X_AXIS_VALUES.map(({ value, label }) => ({
          id: value,
          label,
          icon: <InsightOptionIcon value={value} />,
        }))
      : ENTITY_AXES[metric].map((id) => ({
          id,
          icon: (
            <InsightOptionIcon value={metric === "users" && id === ChartXAxisProperty.STATE_GROUPS ? "ROLE" : id} />
          ),
          label: t(
            `workspace_analytics.insights.axes.${metric === "users" && id === ChartXAxisProperty.STATE_GROUPS ? "ROLE" : id}`
          ),
        }));
  const axisLabel = axes.find(({ id }) => id === axis)?.label;
  return (
    <AnalyticsWrapper i18nTitle="workspace_analytics.insights.title">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2" data-insight-controls>
          <AnalyticsChoice
            label={t("workspace_analytics.project_analysis.metric")}
            value={metric}
            options={INSIGHT_METRICS.map((id) => ({
              id,
              label: t(`workspace_analytics.insights.metrics.${id}`),
              icon: <InsightOptionIcon value={id} />,
            }))}
            onChange={(value) => {
              setMetric(value);
              setAxis(value === "work-items" ? ChartXAxisProperty.PRIORITY : ENTITY_AXES[value][0]);
              setGroup("");
            }}
          />
          <AnalyticsChoice
            label={t("workspace_analytics.insights.dimension")}
            value={axis}
            options={axes.filter(({ id }) => id !== group)}
            onChange={setAxis}
          />
          <AnalyticsChoice
            label={t("workspace_analytics.insights.group")}
            value={group}
            options={axes.filter(({ id }) => id !== axis)}
            placeholder={t("workspace_analytics.insights.add_group")}
            placeholderIcon={<InsightOptionIcon value="" />}
            onClear={() => setGroup("")}
            onChange={setGroup}
          />
        </div>
        {metric === "work-items" ? (
          <PriorityChart
            x_axis={axis}
            y_axis={ChartYAxisMetric.WORK_ITEM_COUNT}
            group_by={group ? (group as ChartXAxisProperty) : undefined}
          />
        ) : (
          <EntityInsights
            metric={metric}
            axis={axis}
            group={group ? (group as ChartXAxisProperty) : undefined}
            dimensionLabel={axisLabel}
          />
        )}
      </div>
    </AnalyticsWrapper>
  );
}
