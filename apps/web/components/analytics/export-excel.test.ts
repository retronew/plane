import { expect, it } from "vitest";
import { getAnalyticsExcelData } from "./export-excel";

it("preserves localized column order, numeric zero and literal formula-looking names in Excel", () => {
  const data = getAnalyticsExcelData([
    { 名称: "=SUM(A1:A2)", 数量: 0, 完成率: 33 },
    { 名称: "项目，包含换行\n与中文", 数量: 12, 完成率: 100 },
  ]);
  expect(data[0].map((cell) => (cell as { value: string }).value)).toEqual(["名称", "数量", "完成率"]);
  expect(data[1][0]).toMatchObject({ value: "=SUM(A1:A2)", type: String });
  expect(data[1][1]).toMatchObject({ value: 0, type: Number });
  expect(data[2][0]).toMatchObject({ value: "项目，包含换行\n与中文", type: String, wrap: true });
  expect(data[2][2]).toMatchObject({ value: 100, type: Number });
});
