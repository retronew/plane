import { expect, it } from "vitest";
import {
  APPLE_CHART_COLORS,
  CHART_COLOR_PALETTES,
  CHART_PRIORITY_COLORS,
  CHART_SEMANTIC_COLORS,
  CHART_SERIES_COLORS,
} from "@plane/constants";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
import type { IState } from "@plane/types";
import { generateBarColor } from "./utils";
const color = (value: string, axis: ChartXAxisProperty, states?: IState[]) =>
  generateBarColor(value, { x_axis: axis, y_axis: ChartYAxisMetric.WORK_ITEM_COUNT }, [...CHART_SERIES_COLORS], states);
it("keeps completed state meaning stable across reordered categories", () => {
  expect(color("completed", ChartXAxisProperty.STATE_GROUPS)).toBe(CHART_SEMANTIC_COLORS.completed);
  expect(color("unstarted", ChartXAxisProperty.STATE_GROUPS)).toBe(CHART_SEMANTIC_COLORS.primary);
  expect(color("unknown", ChartXAxisProperty.STATE_GROUPS)).toBe(CHART_SERIES_COLORS[0]);
});
it("uses priority semantics but preserves explicit project state colors", () => {
  expect(color("urgent", ChartXAxisProperty.PRIORITY)).toBe(CHART_PRIORITY_COLORS.urgent);
  expect(color("state-id", ChartXAxisProperty.STATES, [{ id: "state-id", color: "#123456" } as IState])).toBe(
    "#123456"
  );
});
it("does not assign unrelated colors to ordinary project comparisons", () => {
  expect(color("project-a", ChartXAxisProperty.PROJECTS)).toBe(color("project-b", ChartXAxisProperty.PROJECTS));
});

it("derives both theme palettes and semantic colors from the same Apple color pairs", () => {
  const modern = CHART_COLOR_PALETTES.find((palette) => palette.key === "modern")!;
  expect(modern.light[0]).toBe(APPLE_CHART_COLORS.blue[0]);
  expect(modern.dark[0]).toBe(APPLE_CHART_COLORS.blue[1]);
  expect(modern.light[1]).toBe(APPLE_CHART_COLORS.green[0]);
  expect(modern.dark[1]).toBe(APPLE_CHART_COLORS.green[1]);
  expect(CHART_SEMANTIC_COLORS.primary).toBe("light-dark(#0088ff, #0091ff)");
  expect(CHART_SEMANTIC_COLORS.completed).toBe("light-dark(#34c759, #30d158)");
});
