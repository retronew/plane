import { describe, expect, it } from "vitest";
import type { ICycle, TProject } from "@plane/types";
import { workspaceCycleChartData } from "@/components/active-cycles/chart-data";
import { cycleFixture } from "@/components/active-cycles/fixtures.test-support";
import { projectActiveCycleData, projectCycleChartData } from "./project-active-cycle-data";

const cycle: ICycle = {
  ...cycleFixture,
  description: "",
  owned_by_id: "owner",
  sort_order: 1,
  archived_at: null,
  workspace_id: "workspace",
  view_props: { filters: {} },
  progress: [],
  progress_snapshot: undefined,
  version: 1,
  backlog_estimate_points: 0,
  started_estimate_points: 0,
  unstarted_estimate_points: 0,
  cancelled_estimate_points: 0,
};
const project: Pick<TProject, "id" | "name" | "identifier" | "logo_props" | "timezone"> = {
  ...cycleFixture.project_detail,
  timezone: "America/Los_Angeles",
};
const snapshots = Object.values(cycleFixture.progress_chart).filter((snapshot) => snapshot !== null);

describe("project active cycle snapshot adaptation", () => {
  it("uses project calendar dates at the UTC day boundary and never inserts list counts into history", () => {
    const data = projectActiveCycleData(cycle, project, snapshots, new Date("2026-10-17T01:00:00Z"));
    expect(data?.today).toBe("2026-10-16");
    expect(data?.chart_start_date).toBe("2026-10-11");
    expect(data?.chart_end_date).toBe("2026-10-23");
    expect(data?.progress_chart["2026-10-13"]).toBeNull();
    expect(data?.progress_chart["2026-10-17"]).toBeNull();
    expect(data?.progress_chart["2026-10-12"]).toEqual(snapshots[0]);
    expect(data?.days_remaining).toBe(6);
  });

  it("uses the latest real observation for current totals and preserves each historical scope", () => {
    const today = {
      ...snapshots[1],
      observed_at: "2026-10-16T18:00:00Z",
      total_issues: 22,
      cancelled_issues: 2,
      started_issues: 13,
    };
    const data = projectActiveCycleData(cycle, project, [...snapshots, today], new Date("2026-10-16T20:00:00Z"));
    expect(data?.total_issues).toBe(22);
    expect(data?.started_issues).toBe(13);
    if (!data) throw new Error("Expected current cycle data");
    const chart = workspaceCycleChartData(data);
    expect(chart.data.find((point) => point.timestamp === Date.parse("2026-10-12"))?.scope).toBe(11);
    expect(chart.data.find((point) => point.timestamp === Date.parse("2026-10-16"))?.scope).toBe(20);
    expect(chart.scope).toBe(20);
  });

  it("ignores future observations and keeps missing historical observations null", () => {
    const future = { ...snapshots[0], progress_date: "2026-10-13", observed_at: "2026-10-18T00:00:00Z" };
    const data = projectActiveCycleData(cycle, project, [future], new Date("2026-10-16T20:00:00Z"));
    expect(data?.progress_chart["2026-10-13"]).toBeNull();
    expect(data?.progress_chart["2026-10-16"]).toBeNull();
    expect(data?.total_issues).toBe(cycle.total_issues);
  });

  it("does not synthesize current/final observations for ended, upcoming, or undated cycles", () => {
    expect(projectActiveCycleData(cycle, project, snapshots, new Date("2026-11-01"))).toBeNull();
    expect(projectActiveCycleData(cycle, project, snapshots, new Date("2026-10-01"))).toBeNull();
    expect(projectActiveCycleData({ ...cycle, start_date: null }, project, snapshots)).toBeNull();
    expect(projectActiveCycleData(cycle, { ...project, timezone: undefined }, snapshots)).toBeNull();
    expect(projectActiveCycleData(cycle, { ...project, id: "other" }, snapshots)).toBeNull();
  });

  it("reads ended detail history without fabricating final or post-cycle observations", () => {
    const data = projectCycleChartData(cycle, project, snapshots, new Date("2026-11-01"));
    expect(data?.today).toBe("2026-10-23");
    expect(data?.progress_chart["2026-10-23"]).toBeNull();
    expect(data?.progress_chart).not.toHaveProperty("2026-11-01");
    expect(data?.progress_chart["2026-10-12"]).toEqual(snapshots[0]);
    expect(data?.days_remaining).toBe(0);
    if (!data) throw new Error("Expected ended chart data");
    expect(
      workspaceCycleChartData(data).data.find((point) => point.timestamp === Date.parse(data.today))?.actual
    ).toBeNull();
  });

  it("stops early-completed history at the real completion instant while retaining the planned end", () => {
    const completed = { ...cycle, completed_at: "2026-10-16T19:00:00Z" };
    const afterCompletion = { ...snapshots[1], observed_at: "2026-10-16T20:00:00Z", total_issues: 999 };
    const data = projectCycleChartData(completed, project, [...snapshots, afterCompletion], new Date("2026-10-20"));
    expect(projectActiveCycleData(completed, project, snapshots, new Date("2026-10-17"))).toBeNull();
    expect(data?.today).toBe("2026-10-16");
    expect(data?.chart_end_date).toBe("2026-10-23");
    expect(data?.end_date).toBe(cycle.end_date);
    expect(data?.progress_chart["2026-10-16"]).toEqual(snapshots[1]);
    expect(data?.progress_chart["2026-10-23"]).toBeNull();
    expect(data?.days_remaining).toBe(0);
    expect(data?.total_issues).not.toBe(999);
  });

  it("handles upcoming, undated, and invalid ranges without chart data", () => {
    expect(projectCycleChartData(cycle, project, snapshots, new Date("2026-10-01"))).toBeNull();
    expect(projectCycleChartData({ ...cycle, end_date: null }, project, snapshots)).toBeNull();
    expect(projectCycleChartData({ ...cycle, end_date: "2020-01-01" }, project, snapshots)).toBeNull();
  });

  it("bounds long cycle grids with the same sampling interval as workspace cards", () => {
    const data = projectActiveCycleData(
      { ...cycle, start_date: "2020-01-01T00:00:00Z", end_date: "2030-01-01T00:00:00Z" },
      project,
      snapshots,
      new Date("2026-10-16T20:00:00Z")
    );
    expect(Object.keys(data?.progress_chart ?? {}).length).toBeLessThanOrEqual(368);
    expect(data?.progress_chart).toHaveProperty("2026-10-16");
  });
});
