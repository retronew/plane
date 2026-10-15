import { ISSUE_PRIORITY_FILTERS } from "@plane/constants";
import { ChartXAxisProperty } from "@plane/types";
import type { TChart } from "@plane/types";

export function localizeInsightChart(
  chart: TChart,
  axis: ChartXAxisProperty,
  group: ChartXAxisProperty | undefined,
  t: (key: string) => string
): TChart {
  const name = (value: string, property?: ChartXAxisProperty) => {
    const normalized = value.toLowerCase();
    if (property === ChartXAxisProperty.PRIORITY) {
      const priority = ISSUE_PRIORITY_FILTERS.find((item) => item.key === normalized);
      if (priority) return t(priority.titleTranslationKey);
    }
    if (
      property === ChartXAxisProperty.STATE_GROUPS &&
      ["backlog", "unstarted", "started", "completed", "cancelled"].includes(normalized)
    )
      return t(`workspace_projects.state.${normalized}`);
    if (["none", "null"].includes(normalized)) return t("common.none");
    return value;
  };
  return {
    data: chart.data.map((item) => Object.assign({}, item, { name: name(item.name, axis) })),
    schema: Object.fromEntries(Object.entries(chart.schema).map(([key, value]) => [key, name(value, group)])),
  };
}
