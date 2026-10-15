import { expect, it } from "vitest";
import { progressChartData } from "./progress-data";
it("sorts dates and computes ideal progress by elapsed time rather than point index", () => {
  const rows = progressChartData({ "2026-10-11": 0, "2026-10-01": 10, "2026-10-02": 9 }, 10);
  expect(rows.map((row) => row.ideal)).toEqual([10, 9, 0]);
  expect(rows.map((row) => row.current)).toEqual([10, 9, 0]);
});
it("preserves missing observations and handles empty and single-date series", () => {
  expect(progressChartData({}, 5)).toEqual([]);
  expect(progressChartData({ "2026-10-01": null }, 5)[0]).toEqual({
    timestamp: Date.parse("2026-10-01"),
    current: null,
    ideal: 5,
  });
});
