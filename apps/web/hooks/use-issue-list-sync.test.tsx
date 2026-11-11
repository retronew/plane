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
  expect(mocks.store.fetchIssuesWithExistingPagination).toHaveBeenCalledWith(
    "w",
    "p",
    "v",
    "mutation",
    true,
    undefined
  );
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

it("cleans up both subscriptions when replacing a fetched view and unmounting", async () => {
  const firstMutationCleanup = vi.fn();
  const secondMutationCleanup = vi.fn();
  mocks.mutation.mockReturnValueOnce(firstMutationCleanup).mockReturnValueOnce(secondMutationCleanup);
  const hook = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  await act(() => hook.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "v"));
  expect(mocks.cleanup).not.toHaveBeenCalled();
  await act(() => hook.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "another"));
  expect(mocks.cleanup).toHaveBeenCalledTimes(1);
  expect(firstMutationCleanup).toHaveBeenCalledOnce();
  expect(secondMutationCleanup).not.toHaveBeenCalled();
  hook.unmount();
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  expect(firstMutationCleanup).toHaveBeenCalledOnce();
  expect(secondMutationCleanup).toHaveBeenCalledOnce();
});

it("aborts the current store request when the engine suspends", async () => {
  const hook = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  await act(() => hook.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "v"));
  const subscription = mocks.subscribe.mock.calls[0][0];
  const current = new AbortController();
  mocks.store.controller = current;
  subscription.abort();
  expect(current.signal.aborted).toBe(true);
  hook.unmount();
});

it("passes display-only replay metadata to the loaded-window refresh", async () => {
  const hook = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  await act(() => hook.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "v"));
  const context = { issueIds: ["i"], changedFields: ["name"] };
  await mocks.subscribe.mock.calls[0][0].refresh(context);
  expect(mocks.store.fetchIssuesWithExistingPagination).toHaveBeenCalledWith("w", "p", "v", "mutation", true, context);
  hook.unmount();
});

it("waits for an applied initial response before subscribing", async () => {
  let finish!: (value: unknown) => void;
  const fetch = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const hook = renderHook(() =>
    useIssueListSync(EIssuesStoreType.PROJECT_VIEW, { fetchIssues: fetch } as unknown as IssueActions)
  );
  let pending!: Promise<unknown>;
  act(() => {
    pending = hook.result.current.fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, "v");
  });
  expect(mocks.subscribe).not.toHaveBeenCalled();
  await act(async () => {
    finish({ results: [] });
    await pending;
  });
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  hook.unmount();
});
it("removes the old subscription immediately and ignores superseded or unapplied responses", async () => {
  const pending: ((value: unknown) => void)[] = [];
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ results: [] })
    .mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  const hook = renderHook(() =>
    useIssueListSync(EIssuesStoreType.PROJECT_VIEW, { fetchIssues: fetch } as unknown as IssueActions)
  );
  const options = { canGroup: false, perPageCount: 100 };
  await act(() => hook.result.current.fetchIssues("init-loader", options, "v"));
  let first!: Promise<unknown>;
  let second!: Promise<unknown>;
  act(() => {
    first = hook.result.current.fetchIssues("init-loader", options, "v");
  });
  expect(mocks.cleanup).toHaveBeenCalledOnce();
  act(() => {
    second = hook.result.current.fetchIssues("init-loader", options, "v");
  });
  await act(async () => {
    pending[0]({ results: [] });
    await first;
  });
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  await act(async () => {
    pending[1](undefined);
    await second;
  });
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  hook.unmount();
});
