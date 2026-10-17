import { observable, runInAction } from "mobx";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TCycleFilters } from "@plane/types";
import { CyclesViewHeader } from "./cycles-view-header";

const mocks = observable(
  {
    filters: {} as TCycleFilters,
    searchQuery: "",
    updateFilters: vi.fn(),
    updateSearchQuery: vi.fn(),
  },
  { updateFilters: false, updateSearchQuery: false },
  { deep: false }
);
vi.mock("@/hooks/store/use-cycle-filter", () => ({
  useCycleFilter: () => ({
    currentProjectFilters: mocks.filters,
    searchQuery: mocks.searchQuery,
    updateFilters: mocks.updateFilters,
    updateSearchQuery: mocks.updateSearchQuery,
  }),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.filters = {};
  mocks.searchQuery = "";
  await setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.getAnimations ??= () => [];
});
afterEach(() => vi.unstubAllGlobals());

it("updates and clears search through the real controlled Propel search", async () => {
  const { rerender } = render(<CyclesViewHeader projectId="project" />);
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  const input = await screen.findByRole("searchbox");
  fireEvent.change(input, { target: { value: "Sprint two" } });
  expect(mocks.updateSearchQuery).toHaveBeenLastCalledWith("Sprint two");
  act(() =>
    runInAction(() => {
      mocks.searchQuery = "Sprint two";
    })
  );
  rerender(<CyclesViewHeader projectId="project" />);
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("Sprint two");
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(mocks.updateSearchQuery).toHaveBeenLastCalledWith("");
  expect(mocks.updateFilters).not.toHaveBeenCalled();
});

it("toggles status using the real filter trigger and submenu without mutating store filters", async () => {
  const statuses = Object.freeze(["current"]);
  const startDates = Object.freeze(["2026-10-01;after"]);
  mocks.filters = Object.freeze({ status: statuses, start_date: startDates }) as unknown as TCycleFilters;
  const { rerender } = render(<CyclesViewHeader projectId="project" />);
  const trigger = screen.getByRole("button", { name: "Filters" });
  expect(trigger.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("menuitem", { name: /^Status/ }));
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Draft" }));
  expect(mocks.updateFilters).toHaveBeenLastCalledWith("project", { status: ["current", "draft"] });
  expect(statuses).toEqual(["current"]);
  expect(mocks.filters.start_date).toBe(startDates);
  const nextStatuses = Object.freeze(["current", "draft"]);
  act(() =>
    runInAction(() => {
      mocks.filters = Object.freeze({ status: nextStatuses, start_date: startDates }) as unknown as TCycleFilters;
    })
  );
  rerender(<CyclesViewHeader projectId="project" />);
  const current = screen.getByRole("menuitemcheckbox", { name: "In progress" });
  fireEvent.click(current);
  expect(mocks.updateFilters).toHaveBeenLastCalledWith("project", { status: ["draft"] });
  expect(nextStatuses).toEqual(["current", "draft"]);
  expect(screen.getByRole("menuitemcheckbox", { name: "Draft" })).toBeTruthy();
  expect(mocks.updateSearchQuery).not.toHaveBeenCalled();
});

it("removes a multi-value custom date range as one patch and leaves preset values intact", async () => {
  const dates = Object.freeze(["1_weeks;after", "2026-10-01;after", "2026-10-31;before"]);
  mocks.filters = Object.freeze({ start_date: dates }) as unknown as TCycleFilters;
  render(<CyclesViewHeader projectId="other-project" />);
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /^Start date/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /^Custom/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
  await waitFor(() =>
    expect(mocks.updateFilters).toHaveBeenCalledWith("other-project", { start_date: ["1_weeks;after"] })
  );
  expect(dates).toEqual(["1_weeks;after", "2026-10-01;after", "2026-10-31;before"]);
});

it("reflects cleared filters in the real trigger", () => {
  mocks.filters = { status: ["current"] };
  const { rerender } = render(<CyclesViewHeader projectId="project" />);
  expect(screen.getByRole("button", { name: "Filters" }).getAttribute("aria-pressed")).toBe("true");
  act(() =>
    runInAction(() => {
      mocks.filters = {};
    })
  );
  rerender(<CyclesViewHeader projectId="project" />);
  expect(screen.getByRole("button", { name: "Filters" }).getAttribute("aria-pressed")).toBe("false");
});
