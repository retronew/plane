import { expect, it, vi } from "vitest";
import { EIssueFilterType } from "@plane/constants";
import { EIssueLayoutTypes } from "@plane/types";
import type { IIssueRootStore } from "../root.store";
import { ProjectIssuesFilter } from "./filter.store";

function setup() {
  const refetch = vi.fn();
  const clear = vi.fn();
  const filter = new ProjectIssuesFilter({
    projectIssues: { fetchIssuesWithExistingPagination: refetch, clear },
  } as unknown as IIssueRootStore);
  filter.filters.project = {
    richFilters: {},
    displayProperties: {},
    kanbanFilters: { group_by: [], sub_group_by: [] },
    displayFilters: { layout: EIssueLayoutTypes.LIST, group_by: "priority", order_by: "-created_at" },
  };
  const persist = vi.spyOn(filter.projectService, "updateProjectUserProperties").mockResolvedValue({} as never);
  return { filter, refetch, clear, persist };
}
it("persists display-only changes once without fetching issues or repeating unchanged writes", async () => {
  const { filter, refetch, persist } = setup();
  await filter.updateFilters("workspace", "project", EIssueFilterType.DISPLAY_FILTERS, { show_empty_groups: true });
  await filter.updateFilters("workspace", "project", EIssueFilterType.DISPLAY_FILTERS, { show_empty_groups: true });
  expect(refetch).not.toHaveBeenCalled();
  expect(persist).toHaveBeenCalledTimes(1);
});
it("lets the root fetch new grouping with the latest sort, and fetches a subsequent sort only once", async () => {
  const { filter, refetch, persist } = setup();
  await filter.updateFilters("workspace", "project", EIssueFilterType.DISPLAY_FILTERS, {
    group_by: "state",
    order_by: "created_at",
  });
  expect(refetch).not.toHaveBeenCalled();
  await filter.updateFilters("workspace", "project", EIssueFilterType.DISPLAY_FILTERS, { order_by: "-created_at" });
  expect(refetch).toHaveBeenCalledExactlyOnceWith("workspace", "project", "mutation");
  expect(persist).toHaveBeenCalledTimes(2);
});

it("does not clear loaded issues when an unchanged layout only normalizes empty grouping", async () => {
  const { filter, clear, refetch } = setup();
  filter.filters.project.displayFilters!.group_by = null;
  await filter.updateFilters("workspace", "project", EIssueFilterType.DISPLAY_FILTERS, {
    layout: EIssueLayoutTypes.LIST,
  });
  expect(filter.filters.project.displayFilters?.sub_group_by).toBeNull();
  expect(clear).not.toHaveBeenCalled();
  expect(refetch).not.toHaveBeenCalled();
});

it("persists creator visibility together with existing hidden columns without refetching issues", async () => {
  const { filter, refetch, persist } = setup();
  filter.filters.project.displayProperties = { priority: false, state: true, created_by: false };
  await filter.updateFilters("workspace", "project", EIssueFilterType.DISPLAY_PROPERTIES, { created_by: true });
  expect(persist).toHaveBeenLastCalledWith("workspace", "project", {
    display_properties: { priority: false, state: true, created_by: true },
  });
  expect(filter.computedDisplayProperties(filter.filters.project.displayProperties!)).toMatchObject({
    priority: false,
    state: true,
    created_by: true,
  });
  expect(refetch).not.toHaveBeenCalled();
});
