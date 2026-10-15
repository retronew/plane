import { expect, it } from "vitest";
import { ChartXAxisProperty } from "@plane/types";
import { localizeInsightChart } from "./localize-chart";
it("localizes priority names and grouped labels without changing their keys or counts", () => {
  const source = { data: [{ key: "high", name: "High", count: 3 }], schema: { none: "None", low: "Low" } };
  const parsed = localizeInsightChart(source, ChartXAxisProperty.PRIORITY, ChartXAxisProperty.PRIORITY, (key) => key);
  expect(parsed.data[0]).toEqual({ key: "high", name: "issue.priority.high", count: 3 });
  expect(parsed.schema).toEqual({ none: "common.none", low: "issue.priority.low" });
  expect(source.data[0].name).toBe("High");
});
it("preserves user-defined state and member names", () => {
  const chart = { data: [{ key: "x", name: "My custom state", count: 2 }], schema: {} };
  expect(localizeInsightChart(chart, ChartXAxisProperty.STATES, undefined, (key) => key).data[0].name).toBe(
    "My custom state"
  );
});
