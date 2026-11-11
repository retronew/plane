import { act, render, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import { useIssueListSync } from "@/hooks/use-issue-list-sync";
import type { IssueActions } from "@/hooks/use-issues-actions";
import { WorkspaceSpreadsheetRoot } from "./workspace-root";

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn((_subscription: { key: string; refresh: () => Promise<unknown> }) => vi.fn()),
  mutation: vi.fn(() => vi.fn()),
  initialFetch: vi.fn().mockResolvedValue({ results: [] }),
  store: {
    requestEntity: JSON.stringify(["ws", "view"]),
    controller: new AbortController(),
    fetchIssues: vi.fn(),
    fetchIssuesWithExistingPagination: vi.fn().mockResolvedValue(undefined),
    getIssueLoader: () => "init-loader",
    getPaginationData: () => undefined,
    groupedIssueIds: undefined,
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "ws", globalViewId: "view" }) }));
vi.mock("@/lib/sync/issue-sync", () => ({ issueSync: { subscribe: mocks.subscribe } }));
vi.mock("@/services/issue-sync-mutation", () => ({ onIssueSyncMutation: mocks.mutation }));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({ issues: mocks.store, issuesFilter: { filters: {}, updateFilters: vi.fn() } }),
}));
vi.mock("@/hooks/use-issues-actions", () => {
  const actions = { fetchIssues: mocks.initialFetch } as unknown as IssueActions;
  return { useIssuesActions: (type: EIssuesStoreType) => useIssueListSync(type, actions) };
});
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: vi.fn() }) }));
vi.mock("@/hooks/use-workspace-issue-properties", () => ({ useWorkspaceIssueProperties: vi.fn() }));
vi.mock("@/components/issues/issue-layouts/quick-action-dropdowns", () => ({ AllIssueQuickActions: () => null }));
vi.mock("../../issue-layout-HOC", () => ({ IssueLayoutHOC: () => null, IssueLayoutLoader: () => null }));
vi.mock("../spreadsheet-view", () => ({ SpreadsheetView: () => null }));

it("registers a global list subscription through the actual spreadsheet loading entry", async () => {
  const component = render(
    <WorkspaceSpreadsheetRoot
      workspaceSlug="ws"
      globalViewId="view"
      isDefaultView
      toggleLoading={vi.fn()}
      routeFilters={{}}
      fetchNextPages={vi.fn()}
      globalViewsLoading={false}
      issuesLoading
    />
  );
  await waitFor(() => expect(mocks.subscribe).toHaveBeenCalledOnce());
  expect(mocks.store.fetchIssues).not.toHaveBeenCalled();
  expect(mocks.initialFetch).toHaveBeenCalledWith("init-loader", { canGroup: false, perPageCount: 100 }, undefined);
  const subscription = mocks.subscribe.mock.calls[0][0];
  expect(subscription.key).toContain("list");
  await act(() => subscription.refresh());
  expect(mocks.store.fetchIssuesWithExistingPagination).toHaveBeenCalledWith("ws", "view", "mutation", true, undefined);
  component.unmount();
});
