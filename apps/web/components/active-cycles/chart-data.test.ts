import { expect, it } from "vitest";
import { workspaceCycleChartData } from "./chart-data";
import { cycleFixture } from "./fixtures.test-support";

it("uses observed scope, completed and started counts in both chart modes", () => {
  const down = workspaceCycleChartData(cycleFixture);
  expect(down.scope).toBe(11);
  expect(down.idealToday).toBe(7);
  expect(down.data.map((point) => point.actual)).toEqual([11, null, 7, null]);
  expect(down.data.map((point) => point.started)).toEqual([1, null, 3, null]);
  const up = workspaceCycleChartData(cycleFixture, true);
  expect(up.idealToday + down.idealToday).toBe(down.scope);
  expect(up.data.map((point) => point.actual)).toEqual([0, null, 4, null]);
  expect(up.data.at(-1)?.ideal).toBe(11);
});

it("ends the ideal curve on the real end date, using the cycle start rather than first observation", () => {
  const snapshot = {
    ...cycleFixture.progress_chart[cycleFixture.today]!,
    total_issues: 24,
    cancelled_issues: 2,
    completed_issues: 15,
  };
  const cycle = {
    ...cycleFixture,
    total_issues: 24,
    cancelled_issues: 2,
    completed_issues: 15,
    chart_start_date: "2026-10-08",
    progress_chart: { "2026-10-08": null, "2026-10-16": snapshot, "2026-10-23": null },
  };
  const down = workspaceCycleChartData(cycle);
  const up = workspaceCycleChartData(cycle, true);
  expect(down.idealToday).toBe(10);
  expect(up.idealToday).toBe(12);
  expect(down.data[0].timestamp).toBe(Date.parse(cycle.today));
  expect(down.data.at(-1)).toMatchObject({ timestamp: Date.parse("2026-10-23"), ideal: 0, actual: null });
});

it("handles an empty or all-cancelled cycle with a single real observation", () => {
  const { data, scope } = workspaceCycleChartData({
    ...cycleFixture,
    total_issues: 1,
    cancelled_issues: 1,
    completed_issues: 0,
    chart_start_date: cycleFixture.today,
    chart_end_date: cycleFixture.today,
    progress_chart: {
      [cycleFixture.today]: {
        ...cycleFixture.progress_chart[cycleFixture.today]!,
        total_issues: 1,
        cancelled_issues: 1,
        completed_issues: 0,
      },
    },
  });
  expect(scope).toBe(0);
  expect(data.every((point) => Number.isFinite(point.ideal))).toBe(true);
  expect(data[0].actual).toBe(0);
});

it("uses a historical day's scope for burn-up rather than subtracting from today's scope", () => {
  const old = {
    ...cycleFixture.progress_chart["2026-10-12"]!,
    total_issues: 22,
    cancelled_issues: 2,
    completed_issues: 5,
    started_issues: 6,
  };
  const cycle = { ...cycleFixture, progress_chart: { ...cycleFixture.progress_chart, "2026-10-12": old } };
  expect(workspaceCycleChartData(cycle).data[0]).toMatchObject({ scope: 20, actual: 15, started: 6 });
  expect(workspaceCycleChartData(cycle, true).data[0]).toMatchObject({ scope: 20, actual: 5, started: 6 });
});

it("leaves missing days empty for all observed series and difference fills", () => {
  const cycle = { ...cycleFixture, progress_chart: { ...cycleFixture.progress_chart, "2026-10-14": null } };
  for (const burnup of [false, true]) {
    const { data } = workspaceCycleChartData(cycle, burnup);
    expect(data.find((point) => point.timestamp === Date.parse("2026-10-14"))).toMatchObject({
      ideal: null,
      actual: null,
      started: null,
      scope: null,
      difference: null,
    });
    expect(
      data.filter((point) => point.timestamp > Date.parse(cycle.today)).every((point) => point.actual == null)
    ).toBe(true);
  }
});

it("fills only observed actual/ideal gaps and preserves leading/lagging in both modes", () => {
  for (const burnup of [false, true]) {
    const ahead = workspaceCycleChartData(cycleFixture, burnup);
    const today = ahead.data.find((point) => point.timestamp === Date.parse(cycleFixture.today));
    expect(today?.difference).toEqual([today?.ideal, today?.actual]);
    expect(ahead.isAhead).toBe(true);
    const snapshot = { ...cycleFixture.progress_chart[cycleFixture.today]!, completed_issues: 2 };
    const behind = workspaceCycleChartData(
      { ...cycleFixture, progress_chart: { ...cycleFixture.progress_chart, [cycleFixture.today]: snapshot } },
      burnup
    );
    expect(behind.isAhead).toBe(false);
  }
});
