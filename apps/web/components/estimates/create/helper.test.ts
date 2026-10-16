import { expect, it } from "vitest";
import { EEstimateSystem } from "@plane/types";
import { getEstimateDisplayName } from "./helper";
it("translates canonical names while retaining custom names", () => {
  const t = (key: string) => (key === "project_settings.estimates.systems.points.label" ? "点数" : "类别");
  expect(getEstimateDisplayName({ name: "Points", type: EEstimateSystem.POINTS }, t)).toBe("点数");
  expect(getEstimateDisplayName({ name: "Categories", type: EEstimateSystem.CATEGORIES }, t)).toBe("类别");
  expect(getEstimateDisplayName({ name: "Sprint effort", type: EEstimateSystem.POINTS }, t)).toBe("Sprint effort");
});
