import { beforeEach, expect, it, vi } from "vitest";
import type { TIssue, TIssuesResponse } from "@plane/types";
import { ALL_ISSUES } from "@plane/constants";
import { issueSync } from "@/lib/sync/issue-sync";
import { ProjectIssues } from "../project/issue.store";
import { CycleIssues } from "../cycle/issue.store";
import { ModuleIssues } from "../module/issue.store";
import { ProjectViewIssues } from "../project-views/issue.store";
import { WorkspaceIssues } from "../workspace/issue.store";
import { ProfileIssues } from "../profile/issue.store";
import { ArchivedIssues } from "../archived/issue.store";
import { IssueStore } from "../issue.store";
vi.mock("@/lib/store-context", () => ({
  store: {},
  rootStore: { projectRoot: { project: { getProjectIdentifierById: () => "P" } } },
}));

const issue = (id: string, extra = {}): TIssue => ({ id, project_id: "p", name: id, ...extra }) as TIssue;
const page = (results: unknown): TIssuesResponse =>
  ({ results, total_count: 3, next_cursor: "2:1:0", prev_cursor: "", next_page_results: false }) as TIssuesResponse;
const options = { canGroup: true, perPageCount: 2 };
function fixture(params: Record<string, unknown> = { order_by: "sort_order" }) {
  const map: Record<string, TIssue> = {};
  const root = {
    rootStore: {
      router: {},
      state: { getStateById: vi.fn(() => ({})), stateMap: {} },
      label: { getLabelById: vi.fn(() => ({})), labelMap: {} },
      memberRoot: { getUserDetails: vi.fn(() => ({})), memberMap: {} },
    },
    issues: {
      issuesMap: map,
      getIssueById: (id: string) => map[id],
      addIssue: vi.fn((issues: TIssue[]) => {
        for (const value of issues) map[value.id] = value;
      }),
    },
    issueDetail: { relation: { extractRelationsFromIssues: vi.fn() } },
  };
  const filters = {
    getFilterParams: vi.fn(() => params),
    issueFilters: { displayFilters: { layout: "list", order_by: "sort_order" } },
  };
  const store = new ProjectIssues(root as never, filters as never);
  store.fetchParentStats = vi.fn();
  const get = vi.spyOn(store.issueService, "getIssues").mockResolvedValue(page([issue("old")]));
  const entities = vi.spyOn(store.issueService, "get").mockImplementation(
    async (url) =>
      ({
        data: url.endsWith("sync/entities/") ? { issues: [issue("old", { name: "new" })], removed_ids: [] } : [],
      }) as never
  );
  return { store, get, entities, root, filters };
}
beforeEach(() => vi.restoreAllMocks());

it("reset replaces known dictionaries across old and new window projects, including deletions", async () => {
  const { store, root, entities } = fixture();
  const request = store.beginIssueRequest("project" as never, "mutation", true);
  root.issues.addIssue([issue("old", { project_id: "previous" })]);
  store.groupedIssueIds = { [ALL_ISSUES]: ["old"] };
  Object.assign(root.rootStore.state.stateMap, {
    known: { id: "known", project_id: "next", name: "before", color: "red" },
    removed: { id: "removed", project_id: "previous" },
    untouched: { id: "untouched", project_id: "other" },
  });
  Object.assign(root.rootStore.label.labelMap, {
    known: { id: "known", project_id: "next", name: "before", color: "red" },
    removed: { id: "removed", project_id: "previous" },
  });
  entities.mockImplementation(
    async (url) =>
      ({
        data: url.includes("projects/next/")
          ? [{ id: "known", project_id: "next", name: "renamed", color: "blue" }]
          : [],
      }) as never
  );
  await store.loadUnknownIssueDictionaries(
    "w",
    request,
    page([issue("new", { project_id: "next", state_id: "known", label_ids: ["known"] })]),
    true
  );
  expect(entities).toHaveBeenCalledTimes(4);
  expect(root.rootStore.state.stateMap).toEqual({
    known: expect.objectContaining({ name: "renamed", color: "blue" }),
    untouched: expect.anything(),
  });
  expect(root.rootStore.label.labelMap).toEqual({ known: expect.objectContaining({ name: "renamed", color: "blue" }) });
});

it.each(["abort", "revision"])("does not commit reset dictionaries after %s", async (mode) => {
  const { store, root, entities } = fixture();
  const request = store.beginIssueRequest("project" as never, "mutation", true);
  Object.assign(root.rootStore.state.stateMap, { known: { id: "known", project_id: "p", name: "before" } });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  entities.mockImplementation(async () => {
    await gate;
    return { data: [] } as never;
  });
  const refresh = store.loadUnknownIssueDictionaries("w", request, page([issue("new")]), true);
  const resume = mode === "revision" ? issueSync.pause() : undefined;
  if (mode === "abort") request.controller.abort();
  release();
  await refresh;
  resume?.();
  expect(root.rootStore.state.stateMap).toHaveProperty("known.name", "before");
});

it("merges display-only entities without reading the list or replacing membership", async () => {
  const { store, get, entities, root } = fixture();
  await store.fetchIssues("w", "p", "mutation", options);
  const ids = store.groupedIssueIds;
  await store.fetchIssuesWithExistingPagination("w", "p", "mutation", true, {
    issueIds: ["old"],
    changedFields: ["name"],
  });
  expect(get).toHaveBeenCalledTimes(1);
  expect(entities).toHaveBeenCalledWith(
    "/api/workspaces/w/sync/entities/",
    expect.objectContaining({ params: { ids: "old" } })
  );
  expect(store.groupedIssueIds).toBe(ids);
  expect(root.issues.getIssueById("old")?.name).toBe("new");
});

it.each([
  [{ order_by: "sort_order", filters: JSON.stringify({ and: [{ name__icontains: "old" }] }) }, ["name"]],
  [{ order_by: "sort_order", text: "old" }, ["description_html"]],
  [{ order_by: "-updated_at" }, ["name"]],
  [{ order_by: "sort_order" }, ["state_id"]],
] as const)("calibrates structural or filter-dependent changes %j", async (params, fields) => {
  const { store, get, entities } = fixture(params);
  await store.fetchIssues("w", "p", "mutation", options);
  get.mockResolvedValue({
    ...page(undefined),
    sync_window: { results: ["next"], entities: [issue("next")], reset_required: false },
  } as TIssuesResponse);
  await store.refreshSyncedIssues("w", { issueIds: ["old"], changedFields: [...fields] });
  expect(get).toHaveBeenLastCalledWith(
    "w",
    "p",
    expect.objectContaining({ sync_window: 1, sync_entity_mode: "changed", sync_depth: 1 }),
    expect.anything()
  );
  expect(entities).not.toHaveBeenCalled();
  expect(store.groupedIssueIds?.[ALL_ISSUES]).toEqual(["next"]);
});

it("hydrates unknown grouped window entities and preserves server ordering", async () => {
  const { store, get, entities, root } = fixture();
  await store.fetchIssues("w", "p", "mutation", options);
  store.groupedIssueIds = { group: { subgroup: ["old", "two", "three"] } };
  get.mockResolvedValue({
    ...page(undefined),
    sync_window: {
      results: { group: { total_results: 2, results: { subgroup: { total_results: 2, results: ["new", "old"] } } } },
      entities: [],
      reset_required: false,
    },
  } as TIssuesResponse);
  entities.mockResolvedValue({
    data: {
      issues: [issue("new", { state_id: "unknown", label_ids: ["label"], assignee_ids: ["member"] })],
      removed_ids: [],
    },
  } as never);
  root.rootStore.state.getStateById.mockReturnValue(undefined as never);
  root.rootStore.label.getLabelById.mockReturnValue(undefined as never);
  root.rootStore.memberRoot.getUserDetails.mockReturnValue(undefined as never);
  entities.mockImplementation(
    async (url) =>
      ({
        data: url.endsWith("sync/entities/")
          ? {
              issues: [issue("new", { state_id: "unknown", label_ids: ["label"], assignee_ids: ["member"] })],
              removed_ids: [],
            }
          : url.endsWith("states/")
            ? [{ id: "unknown" }]
            : url.endsWith("issue-labels/")
              ? [{ id: "label" }]
              : [{ member: { id: "member" } }],
      }) as never
  );
  await store.refreshSyncedIssues("w", { issueIds: ["old"], changedFields: ["state_id"] });
  expect(get).toHaveBeenLastCalledWith("w", "p", expect.objectContaining({ sync_depth: 2 }), expect.anything());
  expect(store.groupedIssueIds).toEqual({ group: { subgroup: ["new", "old"] } });
  expect(root.rootStore.state.stateMap).toHaveProperty("unknown");
  expect(root.rootStore.label.labelMap).toHaveProperty("label");
  expect(root.rootStore.memberRoot.memberMap).toHaveProperty("member");
});

it.each(["reset", "missing", "depth"])("falls back to the full loaded range for %s", async (reason) => {
  const { store, get, entities } = fixture();
  await store.fetchIssues("w", "p", "mutation", options);
  if (reason === "depth")
    store.groupedIssueIds = { [ALL_ISSUES]: Array.from({ length: 41 }, (_, index) => String(index)) };
  entities.mockResolvedValue({ data: { issues: [], removed_ids: ["missing"] } } as never);
  get.mockImplementation(async (_w, _p, params) =>
    (params as Record<string, unknown>)?.sync_window
      ? ({
          ...page(undefined),
          sync_window: { results: ["missing"], entities: [], reset_required: reason === "reset" },
        } as TIssuesResponse)
      : page([issue("fallback")])
  );
  await store.refreshSyncedIssues("w", { changedFields: ["state_id"] });
  expect(store.groupedIssueIds?.[ALL_ISSUES]).toEqual(["fallback"]);
  expect(get.mock.lastCall?.[2]).not.toHaveProperty("sync_window");
});

it.each(["abort", "revision"])("rejects %s races without applying entities", async (race) => {
  const { store, entities, root } = fixture();
  await store.fetchIssues("w", "p", "mutation", options);
  entities.mockImplementation(async () => {
    if (race === "abort") store.controller.abort();
    else issueSync.pause()();
    return { data: { issues: [issue("old", { name: "stale" })], removed_ids: [] } } as never;
  });
  await expect(store.refreshSyncedIssues("w", { issueIds: ["old"], changedFields: ["name"] })).rejects.toHaveProperty(
    "name",
    "AbortError"
  );
  expect(root.issues.getIssueById("old")?.name).toBe("old");
});

it.each([ProjectIssues, CycleIssues, ModuleIssues, ProjectViewIssues, WorkspaceIssues, ProfileIssues, ArchivedIssues])(
  "accepts appended context in $name",
  async (Constructor) => {
    const { root, filters } = fixture();
    const store = new Constructor(root as never, filters as never);
    const refresh = vi.spyOn(store, "refreshSyncedIssues").mockResolvedValue(undefined);
    const context = { issueIds: ["old"], changedFields: ["name"] };
    const args =
      Constructor === CycleIssues || Constructor === ModuleIssues
        ? ["w", "p", "mutation", "scope", true, context]
        : Constructor === ProjectViewIssues
          ? ["w", "p", "view", "mutation", true, context]
          : ["w", "scope", "mutation", true, context];
    await (store.fetchIssuesWithExistingPagination as (...args: unknown[]) => Promise<unknown>)(...args);
    expect(refresh).toHaveBeenCalledWith("w", context);
  }
);

it("does not acknowledge sync without an applied baseline query", async () => {
  const { store } = fixture();
  await expect(
    store.fetchIssuesWithExistingPagination("w", "p", "mutation", true, { issueIds: ["old"] })
  ).rejects.toHaveProperty("name", "AbortError");
});

it("passes reset through the full list refresh even when every dictionary ID is cached", async () => {
  const { store, entities } = fixture();
  await store.fetchIssues("w", "p", "mutation", options);
  await store.refreshSyncedIssues("w", { reset: true });
  expect(entities.mock.calls.map(([url]) => url)).toEqual([
    "/api/workspaces/w/projects/p/states/",
    "/api/workspaces/w/projects/p/issue-labels/",
  ]);
});

it("propagates window and fallback failures without acknowledging sync", async () => {
  const { store, get } = fixture();
  await store.fetchIssues("w", "p", "mutation", options);
  const ids = store.groupedIssueIds;
  get.mockRejectedValue(new Error("offline"));
  await expect(store.refreshSyncedIssues("w", { changedFields: ["state_id"] })).rejects.toThrow("offline");
  await expect(store.refreshSyncedIssues("w", { reset: true })).rejects.toThrow("offline");
  expect(store.groupedIssueIds).toBe(ids);
});

it("accepts a guarded server snapshot even when the cached browser timestamp is in the future", () => {
  const store = new IssueStore();
  store.addIssue([issue("a", { name: "local", updated_at: "2099-11-11T12:00:00Z" })]);
  store.addIssue([issue("a", { name: "remote", updated_at: "2026-11-11T11:00:00Z" })], true);
  expect(store.getIssueById("a")?.name).toBe("remote");
  store.addIssue([issue("a", { name: "latest", updated_at: "2026-11-11T13:00:00Z" })], true);
  expect(store.getIssueById("a")?.updated_at).toBe("2026-11-11T13:00:00Z");
  store.addIssue([issue("a", { name: "ordinary", updated_at: "2026-11-11T11:00:00Z" })]);
  expect(store.getIssueById("a")?.name).toBe("ordinary");
});

it("does not abort an initial layout request when an old sync subscription refreshes", async () => {
  const { store, get } = fixture();
  await store.fetchIssues("w", "p", "mutation", options);
  let resolve!: (response: TIssuesResponse) => void;
  get.mockReturnValue(
    new Promise<TIssuesResponse>((done) => {
      resolve = done;
    })
  );
  const initial = store.fetchIssues("w", "p", "init-loader", { canGroup: false, perPageCount: 100 });
  const controller = store.controller;
  await expect(store.refreshSyncedIssues("w", { issueIds: ["old"], changedFields: ["name"] })).rejects.toHaveProperty(
    "name",
    "AbortError"
  );
  expect(controller.signal.aborted).toBe(false);
  resolve(page([issue("table")]));
  await initial;
  expect(store.groupedIssueIds?.[ALL_ISSUES]).toEqual(["table"]);
});
