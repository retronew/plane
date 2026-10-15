import { beforeEach, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import { EIssueLayoutTypes } from "@plane/types";
import type { IIssueRootStore } from "../root.store";
import { WorkspaceIssuesFilter } from "./filter.store";

const refetch = vi.fn();
function makeFilter(viewId = "all-issues") {
  const root = {
    globalViewId: viewId,
    currentUserId: "current-user",
    workspaceIssues: { fetchIssuesWithExistingPagination: refetch },
  } as unknown as IIssueRootStore;
  const filter = new WorkspaceIssuesFilter(root);
  filter.filters[viewId] = {
    richFilters: { priority__in: "high" },
    displayProperties: {},
    kanbanFilters: { group_by: [], sub_group_by: [] },
    displayFilters: { layout: EIssueLayoutTypes.LIST, group_by: null, order_by: "-created_at", sub_issue: false },
  };
  vi.spyOn(filter.handleIssuesLocalFilters, "set").mockImplementation(() => {});
  return filter;
}
beforeEach(() => vi.clearAllMocks());
it("switches to kanban with shared state categories and sends grouping, sorting and rich filters", async () => {
  const filter = makeFilter();
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { layout: EIssueLayoutTypes.KANBAN },
    "all-issues"
  );
  const params = filter.getFilterParams(
    { canGroup: true, perPageCount: 30 },
    "all-issues",
    undefined,
    undefined,
    undefined
  );
  expect(params).toMatchObject({ group_by: "state__group", order_by: "-created_at", sub_issue: false, per_page: "30" });
  expect(JSON.parse(params.filters as string)).toEqual({ priority__in: "high" });
  expect(refetch).not.toHaveBeenCalled();
  expect(filter.handleIssuesLocalFilters.set).toHaveBeenCalled();
});
it("uses date grouping and bounds for calendar, and removes grouping for table and timeline", async () => {
  // Each layout update must finish before the next mode uses its filter parameters.

  const filter = makeFilter();
  for (const layout of [EIssueLayoutTypes.CALENDAR, EIssueLayoutTypes.SPREADSHEET, EIssueLayoutTypes.GANTT]) {
    // oxlint-disable-next-line no-await-in-loop -- layout transitions are sequential
    await filter.updateFilters("workspace", undefined, EIssueFilterType.DISPLAY_FILTERS, { layout }, "all-issues");
    const params = filter.getFilterParams(
      layout === EIssueLayoutTypes.CALENDAR
        ? { canGroup: true, perPageCount: 4, groupedBy: "target_date", after: "2026-10-01", before: "2026-11-01" }
        : { canGroup: false, perPageCount: 100 },
      "all-issues",
      undefined,
      undefined,
      undefined
    );
    if (layout === EIssueLayoutTypes.CALENDAR)
      expect(params).toMatchObject({ group_by: "target_date", target_date: "2026-10-01;after,2026-11-01;before" });
    else expect(params.group_by).toBeUndefined();
  }
});
it.each([
  ["assigned", "assignees"],
  ["created", "created_by"],
  ["subscribed", "subscriber"],
])("preserves the %s scope and translates group pagination to filters", (viewId, key) => {
  const filter = makeFilter(viewId);
  filter.filters[viewId].displayFilters!.group_by = "priority";
  const params = filter.getFilterParams({ canGroup: true, perPageCount: 1 }, viewId, "1:1:0", "high", undefined);
  expect(params[key as keyof typeof params]).toBe("current-user");
  expect(params).toMatchObject({ priority: "high", cursor: "1:1:0" });
  expect(params.group_by).toBeUndefined();
});
it("keeps custom-view rich filters when changing properties and collapsed groups", async () => {
  const filter = makeFilter("saved-view");
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_PROPERTIES,
    { labels: false },
    "saved-view"
  );
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.KANBAN_FILTERS,
    { group_by: ["high"], sub_group_by: [] },
    "saved-view"
  );
  expect(filter.getIssueFilters("saved-view")).toMatchObject({
    richFilters: { priority__in: "high" },
    displayProperties: { labels: false },
    kanbanFilters: { group_by: ["high"] },
  });
});

it("requests a layout without replacing outgoing data, then commits and persists after exit", async () => {
  const filter = makeFilter();
  filter.requestLayout("all-issues", EIssueLayoutTypes.KANBAN);
  expect(filter.requestedLayouts["all-issues"]).toBe(EIssueLayoutTypes.KANBAN);
  expect(filter.issueFilters?.displayFilters?.layout).toBe(EIssueLayoutTypes.LIST);
  expect(refetch).not.toHaveBeenCalled();
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { layout: EIssueLayoutTypes.KANBAN },
    "all-issues"
  );
  expect(filter.requestedLayouts["all-issues"]).toBeUndefined();
  expect(filter.issueFilters?.displayFilters?.layout).toBe(EIssueLayoutTypes.KANBAN);
  expect(filter.handleIssuesLocalFilters.set).toHaveBeenCalled();
});

it("cancels a pending switch when the user returns to the current layout", () => {
  const filter = makeFilter();
  filter.requestLayout("all-issues", EIssueLayoutTypes.KANBAN);
  filter.requestLayout("all-issues", EIssueLayoutTypes.LIST);
  expect(filter.requestedLayouts["all-issues"]).toBeUndefined();
  expect(filter.issueFilters?.displayFilters?.layout).toBe(EIssueLayoutTypes.LIST);
  expect(refetch).not.toHaveBeenCalled();
});

it("persists presentation changes without requesting issues, and skips unchanged updates", async () => {
  const filter = makeFilter();
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { show_empty_groups: true },
    "all-issues"
  );
  expect(refetch).not.toHaveBeenCalled();
  expect(filter.handleIssuesLocalFilters.set).toHaveBeenCalledTimes(1);
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { show_empty_groups: true },
    "all-issues"
  );
  expect(filter.handleIssuesLocalFilters.set).toHaveBeenCalledTimes(1);
  expect(refetch).not.toHaveBeenCalled();
});
it("leaves grouping to the layout root but refetches a sort change once", async () => {
  const filter = makeFilter();
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { group_by: "priority", order_by: "created_at" },
    "all-issues"
  );
  expect(refetch).not.toHaveBeenCalled();
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { order_by: "-created_at" },
    "all-issues"
  );
  expect(refetch).toHaveBeenCalledExactlyOnceWith("workspace", "all-issues", "mutation");
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { order_by: "-created_at" },
    "all-issues"
  );
  expect(refetch).toHaveBeenCalledTimes(1);
});
it("does not fetch stale calendar bounds when switching month/week, or refetch on weekend toggles", async () => {
  const filter = makeFilter();
  filter.filters["all-issues"].displayFilters!.layout = EIssueLayoutTypes.CALENDAR;
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { calendar: { layout: "week" } },
    "all-issues"
  );
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { calendar: { layout: "week", show_weekends: true } },
    "all-issues"
  );
  expect(refetch).not.toHaveBeenCalled();
  expect(filter.handleIssuesLocalFilters.set).toHaveBeenCalledTimes(2);
});
