import { beforeEach, expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import { EIssueLayoutTypes } from "@plane/types";
import type { IIssueRootStore } from "../root.store";
import { ProfileIssuesFilter } from "./filter.store";

const refetch = vi.fn();
function makeFilter() {
  const root = {
    userId: "profile-user",
    currentUserId: "signed-in-user",
    profileIssues: { fetchIssuesWithExistingPagination: refetch },
  } as unknown as IIssueRootStore;
  const filter = new ProfileIssuesFilter(root);
  filter.filters["profile-user"] = {
    richFilters: {},
    displayProperties: {},
    kanbanFilters: { group_by: [], sub_group_by: [] },
    displayFilters: { layout: EIssueLayoutTypes.LIST, group_by: "priority", order_by: "-created_at" },
  };
  vi.spyOn(filter.handleIssuesLocalFilters, "set").mockImplementation(() => {});
  return filter;
}
beforeEach(() => vi.clearAllMocks());
it("switches to calendar without carrying priority grouping into date queries", async () => {
  const filter = makeFilter();
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { layout: EIssueLayoutTypes.CALENDAR },
    "profile-user"
  );
  const params = filter.getFilterParams(
    { canGroup: true, perPageCount: 4, groupedBy: "target_date", after: "2026-10-01", before: "2026-11-01" },
    "profile-user",
    undefined,
    undefined,
    undefined
  );
  expect(params).toMatchObject({
    group_by: "target_date",
    per_page: "4",
    target_date: "2026-10-01;after,2026-11-01;before",
  });
  expect(refetch).not.toHaveBeenCalled();
});
it("fetches an ungrouped spreadsheet while preserving sorting and per-user preferences", async () => {
  const filter = makeFilter();
  await filter.updateFilters(
    "workspace",
    undefined,
    EIssueFilterType.DISPLAY_FILTERS,
    { layout: EIssueLayoutTypes.SPREADSHEET },
    "profile-user"
  );
  const params = filter.getFilterParams(
    { canGroup: false, perPageCount: 100 },
    "profile-user",
    undefined,
    undefined,
    undefined
  );
  expect(params).toMatchObject({ order_by: "-created_at", per_page: "100" });
  expect(params.group_by).toBeUndefined();
  expect(filter.handleIssuesLocalFilters.set).toHaveBeenCalledWith(
    expect.anything(),
    EIssueFilterType.DISPLAY_FILTERS,
    "workspace",
    "profile-user",
    undefined,
    expect.objectContaining({ display_filters: expect.objectContaining({ layout: EIssueLayoutTypes.SPREADSHEET }) })
  );
});
