import { expect, it } from "vitest";
import { getWorkspaceViewExportFilters } from "./export-filters";

it.each([
  ["assigned", "assignee_id__in"],
  ["created", "created_by_id__in"],
  ["subscribed", "subscriber_id__in"],
])("restricts %s exports to the current user and current rich filters", (view, field) => {
  expect(getWorkspaceViewExportFilters(view, "me", { priority__in: "high" })).toEqual({
    and: [{ priority__in: "high" }, { is_archived__exact: false, is_draft__exact: false }, { [field]: "me" }],
  });
});
it("preserves AND conditions without mutation and respects hidden sub-items", () => {
  const filters = { and: [{ priority__in: "high" }, { project_id__in: "project" }] };
  const before = JSON.stringify(filters);
  expect(getWorkspaceViewExportFilters("saved-view", "me", filters, { sub_issue: false })).toEqual({
    and: [...filters.and, { is_archived__exact: false, is_draft__exact: false }, { parent_id__isnull: true }],
  });
  expect(JSON.stringify(filters)).toBe(before);
});
it("exports all matching items rather than just the loaded pagination page", () => {
  expect(getWorkspaceViewExportFilters("all-issues", "me")).toEqual({
    and: [{ is_archived__exact: false, is_draft__exact: false }],
  });
});
