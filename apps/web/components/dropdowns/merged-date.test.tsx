import { expect, it } from "vitest";
import { setLanguage } from "@plane/i18n";
import { formatCompactCycleDateRange } from "./merged-date";

it("merges shared Chinese months and years while retaining cross-year dates", async () => {
  await setLanguage("zh-CN");
  expect(formatCompactCycleDateRange(new Date(2026, 9, 8), new Date(2026, 9, 23))).toBe("2026年10月8日–23日");
  expect(formatCompactCycleDateRange(new Date(2026, 9, 28), new Date(2026, 10, 3))).toBe("2026年10月28日–11月3日");
  const crossYear = formatCompactCycleDateRange(new Date(2026, 11, 28), new Date(2027, 0, 4));
  expect(crossYear).toContain("2026");
  expect(crossYear).toContain("2027");
  await setLanguage("en");
});
