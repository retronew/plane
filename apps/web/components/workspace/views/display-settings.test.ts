import { expect, it } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import type { IIssueDisplayFilterOptions } from "@plane/types";
import { getWorkspaceViewDisplayFilters, getWorkspaceViewFilterSnapshot } from "./display-settings";

it.each(Object.values(EIssueLayoutTypes))("preserves the selected %s layout in the snapshot", (layout) => {
  expect(
    getWorkspaceViewFilterSnapshot(
      { name__icontains: "中文" },
      { layout: EIssueLayoutTypes.SPREADSHEET },
      { priority: false },
      layout
    )
  ).toMatchObject({
    rich_filters: { name__icontains: "中文" },
    display_filters: { layout },
    display_properties: { priority: false },
  });
});
it("normalizes required board groups without changing inactive layout preferences", () => {
  const source: IIssueDisplayFilterOptions = {
    layout: EIssueLayoutTypes.SPREADSHEET,
    group_by: null,
    calendar: { layout: "week", show_weekends: true },
    order_by: "-priority",
    sub_issue: true,
  };
  const next = getWorkspaceViewDisplayFilters(source, EIssueLayoutTypes.KANBAN);
  expect(next).toMatchObject({
    layout: "kanban",
    group_by: "state_detail.group",
    order_by: "-priority",
    calendar: { layout: "week", show_weekends: true },
    sub_issue: true,
  });
  expect(source.group_by).toBeNull();
  expect(getWorkspaceViewDisplayFilters(next, EIssueLayoutTypes.CALENDAR).group_by).toBe("state_detail.group");
});
it("clears duplicate/unsupported board subgroups and maps project-specific state grouping", () => {
  expect(
    getWorkspaceViewDisplayFilters({ group_by: "state", sub_group_by: "state_detail.group" }, EIssueLayoutTypes.KANBAN)
  ).toMatchObject({ group_by: "state_detail.group", sub_group_by: null });
  expect(
    getWorkspaceViewDisplayFilters({ group_by: "cycle", sub_group_by: "module" }, EIssueLayoutTypes.KANBAN)
  ).toMatchObject({ group_by: "state_detail.group", sub_group_by: null });
});
it("retains calendar settings, descending column sorting, and explicit false flags", () => {
  expect(
    getWorkspaceViewDisplayFilters({
      layout: EIssueLayoutTypes.CALENDAR,
      order_by: "-state__name",
      show_empty_groups: false,
      sub_issue: false,
      calendar: { layout: "week", show_weekends: false },
    })
  ).toMatchObject({
    order_by: "-state__name",
    show_empty_groups: false,
    sub_issue: false,
    calendar: { layout: "week", show_weekends: false },
  });
});
it("detaches the saved query and display settings from later source mutations", () => {
  const query = { and: [{ priority__in: "high" }] };
  const display: IIssueDisplayFilterOptions = { calendar: { layout: "month", show_weekends: false } };
  const properties = { priority: true };
  const snapshot = getWorkspaceViewFilterSnapshot(query, display, properties);
  query.and[0].priority__in = "low";
  display.calendar!.layout = "week";
  properties.priority = false;
  expect(snapshot).toMatchObject({
    rich_filters: { and: [{ priority__in: "high" }] },
    display_filters: { calendar: { layout: "month" } },
    display_properties: { priority: true },
  });
});
it("uses workspace defaults and rejects manual ordering", () => {
  expect(getWorkspaceViewDisplayFilters()).toMatchObject({ layout: "spreadsheet", order_by: "-created_at" });
  expect(getWorkspaceViewDisplayFilters({ order_by: "sort_order" }).order_by).toBe("-created_at");
});
