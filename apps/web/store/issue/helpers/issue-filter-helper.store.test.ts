import { expect, it } from "vitest";
import type { IIssueDisplayFilterOptions } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { IssueFilterHelperStore } from "./issue-filter-helper.store";

const helper = new IssueFilterHelperStore();
const defaults: IIssueDisplayFilterOptions = {
  layout: EIssueLayoutTypes.LIST,
  group_by: "priority",
  order_by: "-created_at",
  sub_issue: false,
};
it.each([
  { show_empty_groups: true },
  { calendar: { show_weekends: true } },
  { group_by: "state" },
  { group_by: null },
  { layout: EIssueLayoutTypes.KANBAN, order_by: "created_at" },
  { group_by: "state", order_by: "created_at" },
] satisfies IIssueDisplayFilterOptions[])(
  "does not refetch presentation changes or duplicate a layout-owned request: %j",
  (patch) => {
    expect(helper.getShouldReFetchIssues(defaults, { ...defaults, ...patch })).toBe(false);
  }
);
it.each([EIssueLayoutTypes.KANBAN, EIssueLayoutTypes.CALENDAR])(
  "leaves grouping and pagination changes to %s",
  (layout) => {
    const previous = { ...defaults, layout };
    const patch =
      layout === EIssueLayoutTypes.KANBAN
        ? { sub_group_by: "labels" as const, order_by: "created_at" as const }
        : { calendar: { layout: "week" as const }, order_by: "created_at" as const };
    expect(helper.getShouldReFetchIssues(previous, { ...previous, ...patch })).toBe(false);
  }
);
it.each(Object.values(EIssueLayoutTypes))(
  "refetches sorting and sub-work-item changes in %s exactly through the store",
  (layout) => {
    const previous = { ...defaults, layout };
    expect(helper.getShouldReFetchIssues(previous, { ...previous, order_by: "created_at" })).toBe(true);
    expect(helper.getShouldReFetchIssues(previous, { ...previous, sub_issue: true })).toBe(true);
    expect(helper.getShouldReFetchIssues(previous, { ...previous })).toBe(false);
  }
);
