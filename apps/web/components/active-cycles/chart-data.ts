import { CHART_SEMANTIC_COLORS } from "@plane/constants";
import type { TWorkspaceActiveCycle } from "@plane/types";

const DAY = 86400000;
export const CYCLE_CHART_COLORS = {
  ideal: CHART_SEMANTIC_COLORS.neutral,
  actual: CHART_SEMANTIC_COLORS.completed,
  started: CHART_SEMANTIC_COLORS.warning,
  scope: CHART_SEMANTIC_COLORS.primary,
};

export function workspaceCycleChartData(cycle: TWorkspaceActiveCycle, burnup = false) {
  const scope = Math.max(0, cycle.total_issues - cycle.cancelled_issues);
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array; target is ES2022
  const dates = Object.keys(cycle.progress_chart).sort();
  const start = Date.parse(cycle.chart_start_date);
  const end = Date.parse(cycle.chart_end_date);
  const firstObservation = dates.find((date) => cycle.progress_chart[date] != null) ?? cycle.today;
  const points = dates
    .filter((date) => date >= firstObservation)
    .map((date) => {
      const timestamp = Date.parse(date);
      const snapshot = cycle.progress_chart[date];
      const dayScope = snapshot
        ? Math.max(0, snapshot.total_issues - snapshot.cancelled_issues)
        : date >= cycle.today
          ? scope
          : null;
      const idealPending = dayScope == null ? null : dayScope * ((end - timestamp) / Math.max(DAY, end - start));
      const ideal = idealPending == null ? null : burnup ? dayScope! - idealPending : idealPending;
      const actual =
        snapshot == null
          ? null
          : burnup
            ? snapshot.completed_issues
            : Math.max(0, dayScope! - snapshot.completed_issues);
      return {
        timestamp,
        ideal,
        actual,
        difference: actual == null || ideal == null ? null : ([ideal, actual] as [number, number]),
        started: snapshot?.started_issues ?? null,
        scope: dayScope,
      };
    });
  // Sparse/long-cycle samples must not connect two observations over days
  // that are absent from the response. An explicit null breaks every series.
  const data = points.flatMap((point, index) => {
    const previous = points[index - 1];
    if (previous?.actual != null && point.actual != null && point.timestamp - previous.timestamp > DAY) {
      return [
        {
          timestamp: previous.timestamp + DAY,
          ideal: null,
          actual: null,
          difference: null,
          started: null,
          scope: null,
        },
        point,
      ];
    }
    return [point];
  });
  const today = data.find((point) => point.timestamp === Date.parse(cycle.today));
  const isAhead =
    today?.actual == null ||
    today.ideal == null ||
    (burnup ? today.actual >= today.ideal : today.actual <= today.ideal);
  return { data, scope, idealToday: burnup ? Math.ceil(today?.ideal ?? 0) : Math.floor(today?.ideal ?? 0), isAhead };
}
