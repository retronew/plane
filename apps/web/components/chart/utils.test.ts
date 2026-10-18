import { expect, it } from "vitest";
import { ChartXAxisProperty } from "@plane/types";
import type { TChart } from "@plane/types";
import { parseChartData } from "./utils";

it("fills missing series without replacing existing values or mutating input", () => {
  const input: TChart = {
    data: [
      { key: "first", name: "high", count: 0, a: 0, extra: 9 },
      { key: "second", name: "low", count: 2, b: 2 },
    ],
    schema: { a: "high", b: "low" },
  };
  const snapshot = structuredClone(input);
  expect(parseChartData(input, ChartXAxisProperty.PRIORITY, ChartXAxisProperty.PRIORITY, null)).toEqual({
    data: [
      { key: "first", name: "High", count: 0, a: 0, b: 0, extra: 9 },
      { key: "second", name: "Low", count: 2, a: 0, b: 2 },
    ],
    schema: { a: "High", b: "Low" },
  });
  expect(input).toEqual(snapshot);
});

it("preserves explicitly present null and undefined fields in runtime payloads", () => {
  const input = {
    data: [{ key: "row", name: "row", count: 0, a: null, b: undefined }],
    schema: { a: "A", b: "B", c: "C", toString: "Own series" },
  } as unknown as TChart;
  const result = parseChartData(input, null, null, null);
  expect(result.data[0]).toMatchObject({ a: null, b: undefined, c: 0, toString: 0 });
  expect(Object.hasOwn(result.data[0], "b")).toBe(true);
});

it("returns an empty chart for absent input", () => {
  expect(parseChartData(undefined, null, null, null)).toEqual({ data: [], schema: {} });
});
