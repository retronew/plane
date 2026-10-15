import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import type { TWorkItemFilterExpression } from "@plane/types";
import { WorkspaceLevelWorkItemFiltersHOC } from "./workspace-level";
const state = vi.hoisted(() => ({
  issuesFilter: {
    filters: {} as Record<
      string,
      { displayFilters: { layout: EIssueLayoutTypes; order_by?: string }; displayProperties: { priority: boolean } }
    >,
    requestedLayouts: {} as Record<string, EIssueLayoutTypes>,
  },
}));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issuesFilter: state.issuesFilter }) }));
vi.mock("@/hooks/store/use-global-view", () => ({
  useGlobalView: () => ({ getViewDetailsById: () => undefined, updateGlobalView: vi.fn() }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me" } }),
  useUserPermissions: () => ({ allowPermissions: () => true }),
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ joinedProjectIds: [] }) }));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => ({ getWorkspaceLabelIds: () => [] }) }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ workspace: { getWorkspaceMemberIds: () => [] } }) }));
vi.mock("@/components/workspace/views/modal", () => ({
  CreateUpdateWorkspaceViewModal: ({ preLoadedData, isOpen }: { preLoadedData: unknown; isOpen: boolean }) =>
    isOpen ? <output data-testid="snapshot">{JSON.stringify(preLoadedData)}</output> : null,
}));
vi.mock("./base", () => ({
  WorkItemFiltersHOC: ({
    saveViewOptions,
  }: {
    saveViewOptions: { onViewSave: (expression: TWorkItemFilterExpression) => void };
  }) => (
    <button
      onClick={() => saveViewOptions.onViewSave({ and: [{ name__icontains: "登录" }, { label_id__in: "label" }] })}
    >
      Save as
    </button>
  ),
}));
beforeEach(() => {
  state.issuesFilter.filters = {};
  state.issuesFilter.requestedLayouts = {};
});
it("reads the pending layout and latest display values at click time, with the current query", () => {
  state.issuesFilter.filters["all-issues"] = {
    displayFilters: { layout: EIssueLayoutTypes.LIST },
    displayProperties: { priority: true },
  };
  render(
    <WorkspaceLevelWorkItemFiltersHOC
      enableSaveView
      entityId="all-issues"
      entityType={EIssuesStoreType.GLOBAL}
      workspaceSlug="workspace"
      filtersToShowByLayout={[]}
      initialWorkItemFilters={{
        richFilters: {},
        displayFilters: { layout: EIssueLayoutTypes.LIST },
        displayProperties: { priority: true },
        kanbanFilters: undefined,
      }}
      updateFilters={() => {}}
    >
      content
    </WorkspaceLevelWorkItemFiltersHOC>
  );
  // The store can change before the animated layout commits or React refreshes the callback.
  state.issuesFilter.requestedLayouts["all-issues"] = EIssueLayoutTypes.KANBAN;
  state.issuesFilter.filters["all-issues"].displayFilters.order_by = "-priority";
  state.issuesFilter.filters["all-issues"].displayProperties.priority = false;
  fireEvent.click(screen.getByText("Save as"));
  expect(JSON.parse(screen.getByTestId("snapshot").textContent!)).toMatchObject({
    rich_filters: { and: [{ name__icontains: "登录" }, { label_id__in: "label" }] },
    display_filters: { layout: "kanban", group_by: "state_detail.group", order_by: "-priority" },
    display_properties: { priority: false },
  });
});
it("keeps temporary creation forms isolated from an existing page's pending selection", () => {
  state.issuesFilter.requestedLayouts["view"] = EIssueLayoutTypes.KANBAN;
  render(
    <WorkspaceLevelWorkItemFiltersHOC
      enableSaveView
      isTemporary
      entityId="view"
      entityType={EIssuesStoreType.GLOBAL}
      workspaceSlug="workspace"
      filtersToShowByLayout={[]}
      initialWorkItemFilters={{
        richFilters: {},
        displayFilters: { layout: EIssueLayoutTypes.CALENDAR },
        displayProperties: { priority: true },
        kanbanFilters: undefined,
      }}
      updateFilters={() => {}}
    >
      content
    </WorkspaceLevelWorkItemFiltersHOC>
  );
  fireEvent.click(screen.getByText("Save as"));
  expect(JSON.parse(screen.getByTestId("snapshot").textContent!).display_filters.layout).toBe("calendar");
});
