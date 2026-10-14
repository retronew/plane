import { expect, it } from "vitest";
import { getCalendarLocale } from "./calendar-locale";
it("localizes month and year navigation for Chinese and preserves other defaults", () => {
  const props = getCalendarLocale("zh-CN");
  expect(props.locale?.code).toBe("zh-CN");
  expect(props.labels?.labelMonthDropdown?.()).toBe("选择月份");
  expect(props.labels?.labelNextYear?.()).toBe("下一年");
  expect(props.labels?.labelYearView?.("2020", "2031")).toBe("选择年份（2020 至 2031）");
  expect(getCalendarLocale("en")).toEqual({});
});
