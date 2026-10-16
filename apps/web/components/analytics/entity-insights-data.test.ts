import { expect, it } from "vitest";
import { ChartXAxisProperty as Axis } from "@plane/types";
import { buildEntityInsights } from "./entity-insights-data";
const t = (key: string) => key;
it("counts entities once, instead of summing associated work items", () => {
  const result = buildEntityInsights(
    [
      { id: "a", name: "Same", status_group: "planning", work_items: 10 },
      { id: "b", name: "Same", status_group: "planning", work_items: 25 },
    ],
    "projects",
    Axis.STATE_GROUPS,
    Axis.PROJECTS,
    t
  );
  expect(result.data[0]).toMatchObject({ count: 2, "entity:a": 1, "entity:b": 1 });
  expect(Object.keys(result.schema)).toHaveLength(2);
});
it("counts active members by role and excludes the unassigned work item bucket", () => {
  const chart = buildEntityInsights(
    [
      { id: "a", name: "A", role: 20, started: 20 },
      { id: "b", name: "B", role: 15, started: 0 },
      { id: "unassigned", name: "", started: 50 },
    ],
    "users",
    Axis.STATE_GROUPS,
    undefined,
    t
  );
  expect(chart.data.map(({ key, count }) => [key, count])).toEqual([
    ["20", 1],
    ["15", 1],
  ]);
});
it("retains parent project IDs and uses real owner IDs", () => {
  const chart = buildEntityInsights(
    [{ id: "m", name: "Module", project_id: "p", lead_id: "u", lead: "Owner" }],
    "modules",
    Axis.MODULES,
    Axis.ASSIGNEES,
    t
  );
  expect(chart.data[0]).toMatchObject({ key: "m", project_id: "p", count: 1, "entity:u": 1 });
});
it("counts intake entries, not project rows, and keeps all five outcomes", () => {
  const chart = buildEntityInsights(
    [{ id: "p", name: "Project", pending: 4, snoozed: 2, accepted: 3, rejected: 1, duplicate: 2, total: 12 }],
    "intake",
    Axis.PROJECTS,
    Axis.STATE_GROUPS,
    t
  );
  expect(chart.data[0].count).toBe(12);
  expect(chart.data[0]["entity:accepted"]).toBe(3);
  expect(Object.keys(chart.schema)).toHaveLength(5);
});
it("returns an empty chart for no matching entities", () => {
  expect(buildEntityInsights([], "users", Axis.ASSIGNEES, undefined, t)).toEqual({ data: [], schema: {} });
});
