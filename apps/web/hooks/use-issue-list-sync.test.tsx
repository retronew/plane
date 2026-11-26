import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SyncEngine, type SyncSubscription } from "@/lib/sync/engine";
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
    resumePagination: vi.fn(),
    fetchIssuesWithExistingPagination: vi.fn(),
  },
}));
let engine: SyncEngine;
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "w", projectId: "p", userId: "u" }) }));
vi.mock("./store/use-issues", () => ({ useIssues: () => ({ issues: mocks.store }) }));
vi.mock("@/lib/sync/issue-sync", () => ({
  issueSync: {
    subscribe: mocks.subscribe,
    get snapshotRevision() {
      return engine.snapshotRevision;
    },
    get revision() {
      return engine.revision;
    },
  },
}));
vi.mock("@/services/issue-sync-mutation", () => ({ onIssueSyncMutation: mocks.mutation }));
afterEach(() => vi.useRealTimers());
beforeEach(() => {
  engine = new SyncEngine(vi.fn());
  vi.clearAllMocks();
  mocks.subscribe.mockReturnValue(mocks.cleanup);
  mocks.mutation.mockReturnValue(() => {});
  mocks.store.requestEntity = JSON.stringify(["w", "p", "v"]);
});
const actions = { fetchIssues: vi.fn().mockResolvedValue({ results: [] }) } as unknown as IssueActions;
const options = { canGroup: false, perPageCount: 100 };
function profileList() {
  vi.useFakeTimers();
  engine.updateProjects(["p"]);
  mocks.subscribe.mockImplementation((sub: SyncSubscription, revision?: number) => engine.subscribe(sub, revision));
  const fetch = vi.fn(async (_load: unknown, _options: unknown, view: string) => {
    mocks.store.requestEntity = JSON.stringify(["w", "u", view]);
    return { results: [] };
  });
  const hook = renderHook(() =>
    useIssueListSync(EIssuesStoreType.PROFILE, { fetchIssues: fetch } as unknown as IssueActions)
  );
  return { hook, fetch };
}

it("fetches each profile tab once on empty replay and still refreshes the active tab on invalidation", async () => {
  const { hook, fetch } = profileList();
  const wake = vi.fn();
  engine.setReplay(wake);
  await act(() => hook.result.current.fetchIssues("init-loader", options, "assigned"));
  await vi.runAllTimersAsync();
  await act(() => hook.result.current.fetchIssues("init-loader", options, "created"));
  await vi.runAllTimersAsync();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(wake).toHaveBeenCalledTimes(2);
  expect(mocks.store.fetchIssuesWithExistingPagination).not.toHaveBeenCalled();
  const context = { issueIds: ["i"], changedFields: ["name"] };
  const applied = engine.apply("p", context);
  await vi.runAllTimersAsync();
  await applied;
  expect(mocks.store.fetchIssuesWithExistingPagination).toHaveBeenCalledExactlyOnceWith(
    "w",
    "u",
    "mutation",
    true,
    context
  );
  hook.unmount();
});

it.each(["fetch", "registration"])("catches replay applied with no subscriber during %s", async (phase) => {
  const { hook, fetch } = profileList();
  const applyEvent = () => engine.apply("p", { issueIds: ["i"], changedFields: ["name"] });
  if (phase === "fetch") {
    fetch.mockImplementationOnce(async () => {
      mocks.store.requestEntity = JSON.stringify(["w", "u", "assigned"]);
      await applyEvent();
      return { results: [] };
    });
  } else {
    mocks.subscribe.mockImplementationOnce((sub: SyncSubscription, revision?: number) => {
      void applyEvent();
      return engine.subscribe(sub, revision);
    });
  }
  await act(() => hook.result.current.fetchIssues("init-loader", options, "assigned"));
  await vi.runAllTimersAsync();
  expect(mocks.store.fetchIssuesWithExistingPagination).toHaveBeenCalledExactlyOnceWith("w", "u", "mutation", true, {
    reset: true,
  });
  hook.unmount();
});

it("re-establishes the initial query when a mutation revision prevented the profile snapshot from applying", async () => {
  const { hook, fetch } = profileList();
  let release!: () => void;
  fetch.mockImplementationOnce(async () => {
    mocks.store.requestEntity = JSON.stringify(["w", "u", "assigned"]);
    release = engine.pause();
    return { results: [] };
  });
  await act(() => hook.result.current.fetchIssues("init-loader", options, "assigned"));
  await vi.runAllTimersAsync();
  expect(fetch).toHaveBeenCalledTimes(1);
  release();
  await vi.runAllTimersAsync();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(mocks.store.fetchIssuesWithExistingPagination).toHaveBeenCalledOnce();
  hook.unmount();
});

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

it("re-arms only the active visible list's pagination on foreground, without a list refresh", async () => {
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  const hook = renderHook(() => useIssueListSync(EIssuesStoreType.PROJECT_VIEW, actions));
  try {
    await act(() => hook.result.current.fetchIssues("init-loader", options, "v"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mocks.store.resumePagination).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mocks.store.resumePagination).toHaveBeenCalledOnce();
    mocks.store.requestEntity = "another";
    window.dispatchEvent(new Event("online"));
    expect(mocks.store.resumePagination).toHaveBeenCalledOnce();
    expect(mocks.store.fetchIssuesWithExistingPagination).not.toHaveBeenCalled();
  } finally {
    hook.unmount();
    hidden.mockRestore();
  }
  mocks.store.requestEntity = JSON.stringify(["w", "p", "v"]);
  window.dispatchEvent(new Event("pageshow"));
  expect(mocks.store.resumePagination).toHaveBeenCalledOnce();
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
