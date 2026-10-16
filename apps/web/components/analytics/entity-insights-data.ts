import { ChartXAxisProperty as Axis } from "@plane/types";
import type { TAnalyticsDetailRow, TAnalyticsDetailTab, TChart, TChartDatum } from "@plane/types";
export type EntityMetric = TAnalyticsDetailTab;
export const ENTITY_AXES: Record<EntityMetric, Axis[]> = {
  projects: [Axis.STATE_GROUPS, Axis.PROJECTS],
  users: [Axis.STATE_GROUPS, Axis.ASSIGNEES],
  cycles: [Axis.PROJECTS, Axis.STATE_GROUPS, Axis.ASSIGNEES, Axis.CYCLES],
  modules: [Axis.PROJECTS, Axis.STATE_GROUPS, Axis.ASSIGNEES, Axis.MODULES],
  intake: [Axis.STATE_GROUPS, Axis.PROJECTS],
};

/** Entity counts, not sums of their associated work items. IDs keep equal names distinct. */
export function buildEntityInsights(
  rows: TAnalyticsDetailRow[],
  metric: EntityMetric,
  axis: Axis,
  group: Axis | undefined,
  t: (key: string) => string
): TChart {
  const data = new Map<string, TChartDatum>();
  const schema: Record<string, string> = {};
  const dimension = (row: TAnalyticsDetailRow, property: Axis): { id: string; name: string } => {
    if (property === Axis.STATE_GROUPS) {
      const id = String(metric === "users" ? row.role : metric === "projects" ? row.status_group : row.status);
      const namespace =
        metric === "users"
          ? "roles"
          : metric === "projects"
            ? "project_statuses"
            : metric === "cycles"
              ? "cycle_statuses"
              : metric === "modules"
                ? "module_statuses"
                : "intake_statuses";
      return { id, name: t(`workspace_analytics.insights.${namespace}.${id}`) };
    }
    if (property === Axis.PROJECTS)
      return { id: String(row.project_id || row.id), name: String(row.project || row.name) };
    if (property === Axis.ASSIGNEES)
      return {
        id: String(metric === "users" ? row.id : row.lead_id || "none"),
        name: String(metric === "users" ? row.name : row.lead || t("unassigned")),
      };
    return { id: String(row.id), name: String(row.name) };
  };
  const entries: (TAnalyticsDetailRow & { weight: number })[] =
    metric === "intake"
      ? rows.flatMap((row) =>
          ["pending", "snoozed", "accepted", "rejected", "duplicate"].map((status) =>
            Object.assign({}, row, { status, weight: Number(row[status] || 0) })
          )
        )
      : rows.filter((row) => row.id !== "unassigned").map((row) => Object.assign({}, row, { weight: 1 }));
  for (const row of entries) {
    const x = dimension(row, axis);
    const datum = data.get(x.id) ?? { key: x.id, name: x.name, count: 0 };
    datum.count += row.weight;
    if (axis === Axis.CYCLES || axis === Axis.MODULES) datum.project_id = String(row.project_id);
    if (group) {
      const g = dimension(row, group);
      // Prefix grouped series IDs so they cannot collide with reserved chart fields.
      const key = `entity:${g.id}`;
      schema[key] = g.name;
      datum[key] = Number(datum[key] || 0) + row.weight;
    }
    data.set(x.id, datum);
  }
  return { data: [...data.values()], schema };
}
