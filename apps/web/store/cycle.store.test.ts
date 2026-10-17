import { beforeEach, expect, it, vi } from "vitest";
import { runInAction } from "mobx";
import { mutate } from "swr";
import { cache, serialize } from "swr/_internal";
import { unstable_serialize } from "swr/infinite";
import type { ICycle, IWorkspaceActiveCyclesResponse, TCycleCompleteResponse } from "@plane/types";
import type { CoreRootStore } from "./root.store";
import { CycleStore } from "./cycle.store";

vi.mock("@/services/project", () => ({ ProjectService: vi.fn(function () {}) }));
vi.mock("@/services/issue", () => ({ IssueService: vi.fn(function () {}) }));
const { completeCycle } = vi.hoisted(() => ({ completeCycle: vi.fn() }));
vi.mock("@/services/cycle.service", () => ({
  CycleService: class {
    completeCycle = completeCycle;
  },
}));
vi.mock("@/services/cycle_archive.service", () => ({ CycleArchiveService: vi.fn(function () {}) }));

const cycle = (id: string, data: Partial<ICycle> = {}) =>
  ({ id, project_id: "project", name: id, status: "current", ...data }) as ICycle;
const makeStore = () => {
  const store = new CycleStore({ router: { projectId: "project" } } as CoreRootStore);
  runInAction(() => {
    store.fetchedMap.project = true;
    store.cycleMap.source = cycle("source", { is_favorite: true });
    store.cycleMap.target = cycle("target", { status: "upcoming", total_issues: 1 });
    store.cycleMap.other = cycle("other", { project_id: "other-project" });
    store.activeCycleIdMap.source = true;
    store.activeCycleIdMap.other = true;
  });
  return store;
};
beforeEach(() => vi.clearAllMocks());

it("merges source and target, preserves server status and snapshots, and updates active selectors", async () => {
  const store = makeStore();
  const snapshot = { total_issues: 9, completed_issues: 3 } as ICycle["progress_snapshot"];
  const response: TCycleCompleteResponse = {
    cycle: cycle("source", { status: "completed", completed_at: "2026-10-18T01:00:00Z", progress_snapshot: snapshot }),
    target_cycle: cycle("target", { status: "upcoming", total_issues: 7 }),
    transferred_issues_count: 6,
  };
  completeCycle.mockResolvedValue(response);
  await expect(
    store.completeCycle("workspace", "project", "source", { incomplete_action: "transfer", target_cycle_id: "target" })
  ).resolves.toEqual(response);
  expect(completeCycle).toHaveBeenCalledWith("workspace", "project", "source", {
    incomplete_action: "transfer",
    target_cycle_id: "target",
  });
  expect(store.cycleMap.source).toMatchObject({ ...response.cycle, is_favorite: true });
  expect(store.cycleMap.target.total_issues).toBe(7);
  expect(store.cycleMap.target.progress_snapshot).toBeUndefined();
  expect(store.activeCycleIdMap).toEqual({ other: true });
  expect(store.currentProjectActiveCycleId).toBeNull();
  expect(store.currentProjectCompletedCycleIds).toEqual(["source"]);
});

it("keeps progress_snapshot untouched when completing without transferring", async () => {
  const store = makeStore();
  completeCycle.mockResolvedValue({
    cycle: cycle("source", { status: "completed", completed_at: "2026-10-18T01:00:00Z" }),
    target_cycle: null,
    transferred_issues_count: 0,
  });
  await store.completeCycle("workspace", "project", "source", { incomplete_action: "keep" });
  expect(store.cycleMap.source.progress_snapshot).toBeUndefined();
  expect(store.cycleMap.target.total_issues).toBe(1);
});

it("leaves cycles and active mapping unchanged if the completion fails", async () => {
  const store = makeStore();
  const error = { error: "Already completed" };
  completeCycle.mockRejectedValue(error);
  await expect(store.completeCycle("workspace", "project", "source", { incomplete_action: "keep" })).rejects.toBe(
    error
  );
  expect(store.cycleMap.source.status).toBe("current");
  expect(store.activeCycleIdMap).toEqual({ source: true, other: true });
});

it("refreshes the current cycle detail issue list after transferring and tolerates refresh failure", async () => {
  const store = makeStore();
  const refresh = vi.fn().mockRejectedValue(new Error("Refresh failed"));
  store.rootStore.router.cycleId = "source";
  store.rootStore.issue = {
    cycleIssues: { fetchIssuesWithExistingPagination: refresh },
  } as unknown as CoreRootStore["issue"];
  completeCycle.mockResolvedValue({
    cycle: cycle("source", { status: "completed" }),
    target_cycle: cycle("target", { status: "upcoming" }),
    transferred_issues_count: 6,
  });
  await expect(
    store.completeCycle("workspace", "project", "source", { incomplete_action: "transfer", target_cycle_id: "target" })
  ).resolves.toMatchObject({ transferred_issues_count: 6 });
  expect(refresh).toHaveBeenCalledWith("workspace", "project", "mutation", "source");
  expect(store.cycleMap.source.status).toBe("completed");
});

it("invalidates cached source and target history while preserving unrelated cycles", async () => {
  const store = makeStore();
  const keys = ["source", "target", "unrelated"].map((id) => [
    "project-active-cycle-history",
    "workspace",
    "project",
    id,
  ]);
  await Promise.all(keys.map((args) => mutate(args, [{ scope: 10 }], false)));
  for (const args of keys) {
    const serialized = serialize(args)[0];
    const registered = { ...cache.get(serialized), _k: args };
    cache.set(serialized, registered);
  }
  completeCycle.mockResolvedValue({
    cycle: cycle("source", { status: "completed" }),
    target_cycle: cycle("target", { status: "upcoming" }),
    transferred_issues_count: 6,
  });
  await store.completeCycle("workspace", "project", "source", {
    incomplete_action: "transfer",
    target_cycle_id: "target",
  });
  expect(await mutate(keys[0])).toBeUndefined();
  expect(await mutate(keys[1])).toBeUndefined();
  expect(await mutate(keys[2])).toEqual([{ scope: 10 }]);
});

it("removes completed cards from workspace pages and the infinite aggregate without touching other workspaces", async () => {
  const store = makeStore();
  const key = ["workspace-active-cycles", "workspace", "10:0:0"];
  const otherKey = ["workspace-active-cycles", "other", "10:0:0"];
  const infiniteKey = unstable_serialize(() => key);
  const page = { results: [{ id: "source" }, { id: "other" }] } as IWorkspaceActiveCyclesResponse;
  await mutate(key, page, false);
  await mutate(otherKey, page, false);
  // useSWR registers the original arguments for filter-based mutation.
  for (const args of [key, otherKey]) {
    const serialized = serialize(args)[0];
    const registered = { ...cache.get(serialized), _k: args };
    cache.set(serialized, registered);
  }
  await mutate(infiniteKey, [page], false);
  completeCycle.mockResolvedValue({
    cycle: cycle("source", { status: "completed" }),
    target_cycle: null,
    transferred_issues_count: 0,
  });
  await store.completeCycle("workspace", "project", "source", { incomplete_action: "keep" });
  expect(await mutate(key)).toMatchObject({ results: [{ id: "other" }] });
  expect(await mutate(infiniteKey)).toMatchObject([{ results: [{ id: "other" }] }]);
  expect(await mutate(otherKey)).toEqual(page);
});
