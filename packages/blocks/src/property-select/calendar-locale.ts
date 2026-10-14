import type { CalendarLabels } from "@makeplane/propel/components/calendar";
import { zhCN } from "date-fns/locale";

const chineseLabels: CalendarLabels = {
  labelMonthDropdown: () => "选择月份",
  labelYearDropdown: () => "选择年份",
  labelPrevious: () => "上个月",
  labelNext: () => "下个月",
  labelPreviousYear: () => "上一年",
  labelNextYear: () => "下一年",
  labelPreviousYearPage: () => "前 12 年",
  labelNextYearPage: () => "后 12 年",
  labelMonthView: (year) => `选择 ${year} 年的月份`,
  labelYearView: (first, last) => `选择年份（${first} 至 ${last}）`,
};

export function getCalendarLocale(language: string) {
  return language === "zh-CN" ? { locale: zhCN, labels: chineseLabels } : {};
}
