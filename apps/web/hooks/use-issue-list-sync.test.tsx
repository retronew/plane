import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import type { IssueActions } from "./use-issues-actions";
import { useIssueListSync } from "./use-issue-list-sync";

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  cleanup: vi.fn(),
  mutation: vi.fn(),
  store: {
    requestEntity: JSON.stringify(["w", "p", "v"]),
    controller: new AbortController(),
    fetchIssuesWithExistingPagination: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "w", projectId: "p" }) }));
vi.mock("./store/use-issues", () => ({ useIssues: () => ({ issues: mocks.store }) }));
vi.mock("@/lib/sync/issue-sync", () => ({ issueSync: { subscribe: mocks.subscribe } }));
vi.mock("@/services/issue-sync-mutation", () => ({ onIssueSyncMutation: mocks.mutation }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscribe.mockReturnValue(mocks.cleanup);
  mocks.mutation.mockReturnValue(() => {});
  mocks.store.requestEntity = JSON.stringify(["w", "p", "v"]);
});
const actions = { fetchIssues: vi.fn().mockResolvedValue({ results: [] }) } as unknown as IssueActions;
it("does not subscribe unfetched consumers and cleans up the fetched owner", async () => {
  const owner = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  const unused = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  expect(mocks.subscribe).not.toHaveBeenCalled();
  await act(() => owner.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "v"));
  expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  unused.rerender();
  expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  owner.unmount();
  expect(mocks.cleanup).toHaveBeenCalledOnce();
  unused.unmount();
});
it("preserves pagination and refuses to refresh another active view", async () => {
  const hook = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  await act(() => hook.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "v"));
  const subscription = mocks.subscribe.mock.calls[0][0];
  await subscription.refresh();
  expect(mocks.store.fetchIssuesWithExistingPagination).toHaveBeenCalledWith("w", "p", "v", "mutation");
  mocks.store.fetchIssuesWithExistingPagination.mockClear();
  mocks.store.requestEntity = JSON.stringify(["w", "p", "another"]);
  await subscription.refresh();
  expect(mocks.store.fetchIssuesWithExistingPagination).not.toHaveBeenCalled();
  hook.unmount();
});
it("uses identical keys for identical fetched views", async () => {
  const first = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  const second = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  await act(() => first.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "v"));
  await act(() => second.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "v"));
  expect(mocks.subscribe.mock.calls[0][0].key).toBe(mocks.subscribe.mock.calls[1][0].key);
  first.unmount();
  second.unmount();
});
