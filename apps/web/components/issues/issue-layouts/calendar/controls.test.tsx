import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { observable, runInAction } from "mobx";
import { setLanguage } from "@plane/i18n";
import type { IIssueDisplayFilterOptions } from "@plane/types";
import { CalendarMonthsDropdown } from "./dropdowns/months-dropdown";
import { CalendarHeader } from "./header";
const state = vi.hoisted(() => ({ update: vi.fn() }));
const dates = observable({ activeMonthDate: new Date(2026, 9, 1), activeWeekDate: new Date(2026, 9, 15) });
const filters = observable({
  richFilters: {},
  displayProperties: {},
  kanbanFilters: { group_by: [], sub_group_by: [] },
  displayFilters: { calendar: { layout: "month", show_weekends: false } } as IIssueDisplayFilterOptions,
});
vi.mock("@/hooks/store/use-calendar-view", () => ({
  useCalendarView: () => ({
    calendarFilters: dates,
    allDaysOfActiveWeek: { "2026-10-12": {}, "2026-10-18": {} },
    updateCalendarFilters: (next: Partial<typeof dates>) => {
      state.update(next);
      runInAction(() => Object.assign(dates, next));
    },
    updateCalendarPayload: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ projectId: "project" }) }));
vi.mock("@/hooks/use-window-size", () => ({ default: () => [1280, 800] }));
beforeEach(async () => {
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  runInAction(() => {
    dates.activeMonthDate = new Date(2026, 9, 1);
    filters.displayFilters.calendar = { layout: "month", show_weekends: false };
  });
  state.update.mockClear();
  await setLanguage("zh-CN");
});
it("reuses the localized calendar month/year chooser and updates the displayed month", async () => {
  render(<CalendarMonthsDropdown issuesFilterStore={{ issueFilters: filters }} />);
  fireEvent.click(screen.getByRole("button", { name: /2026年10月/ }));
  const next = await screen.findByRole("button", { name: "下一年" });
  fireEvent.click(next);
  fireEvent.click(screen.getByRole("button", { name: "2027年11月" }));
  await waitFor(() => expect(state.update).toHaveBeenCalledWith({ activeMonthDate: new Date(2027, 10, 1) }));
  expect(screen.getByRole("button", { name: /2027年11月/ })).toBeTruthy();
});
it("aligns ghost Today and secondary Options buttons and keeps calendar options functional", async () => {
  const update = vi.fn<NonNullable<ComponentProps<typeof CalendarHeader>["updateFilters"]>>((_project, _type, next) => {
    runInAction(() => Object.assign(filters.displayFilters, next));
    return Promise.resolve();
  });
  render(
    <CalendarHeader issuesFilterStore={{ issueFilters: filters }} updateFilters={update} setSelectedDate={vi.fn()} />
  );
  const today = screen.getByRole("button", { name: "今天" });
  const options = screen.getByRole("button", { name: "选项" });
  expect(today.getAttribute("data-variant")).toBe("ghost");
  expect(options.getAttribute("data-variant")).toBe("secondary");
  expect(options.getAttribute("data-size")).toBe(today.getAttribute("data-size"));
  fireEvent.click(options);
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "显示周末" }));
  expect(update).toHaveBeenLastCalledWith("project", expect.any(String), {
    calendar: { layout: "month", show_weekends: true },
  });
  fireEvent.click(screen.getByRole("menuitemradio", { name: "周视图" }));
  await waitFor(() => expect(filters.displayFilters.calendar?.layout).toBe("week"));
  expect(screen.getByRole("button", { name: /2026年10月/ }).hasAttribute("disabled")).toBe(true);
  act(() => fireEvent.click(today));
  expect(state.update).toHaveBeenCalled();
});
