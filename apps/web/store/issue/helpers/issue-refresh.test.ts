import { afterEach, describe, expect, it, vi } from "vitest";
import { issueSync } from "@/lib/sync/issue-sync";
import { EIssueLayoutTypes } from "@plane/types";
import type { TIssuesResponse, TLoader } from "@plane/types";
import type { IIssueRootStore } from "../root.store";
import type { IBaseIssueFilterStore } from "./issue-filter-helper.store";
import { IssueFilterHelperStore } from "./issue-filter-helper.store";
import { BaseIssuesStore } from "./base-issues.store";
import { ProjectIssues } from "../project/issue.store";
import { CycleIssues } from "../cycle/issue.store";
import { ModuleIssues } from "../module/issue.store";
import { ProjectViewIssues } from "../project-views/issue.store";
import { WorkspaceIssues } from "../workspace/issue.store";
import { ProfileIssues } from "../profile/issue.store";
import { ArchivedIssues } from "../archived/issue.store";

vi.mock("@/lib/store-context", () => ({ store: {} }));
afterEach(() => vi.restoreAllMocks());
function deferred() {
  let resolve!: (value: TIssuesResponse) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<TIssuesResponse>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const options = { canGroup: true, perPageCount: 30 };
const response = (id: string): TIssuesResponse =>
  ({
    results: id ? [{ id }] : [],
    total_count: id ? 1 : 0,
    next_cursor: "next",
    prev_cursor: "prev",
    next_page_results: true,
  }) as TIssuesResponse;

function setup(scope: string, paginationOptions = options) {
  const filters = {
    issueFilters: { displayFilters: { layout: EIssueLayoutTypes.LIST, group_by: null, sub_group_by: null } },
    getFilterParams: (
      pagination: typeof options,
      _entity: string,
      cursor?: string,
      group?: string,
      subgroup?: string
    ) => IssueFilterHelperStore.prototype.getPaginationParams(undefined, pagination, cursor, group, subgroup),
  } as unknown as IBaseIssueFilterStore;
  const stateMap: Record<string, unknown> = {};
  const labelMap: Record<string, unknown> = {};
  const memberMap: Record<string, unknown> = {};
  const root = {
    rootStore: {
      router: {},
      state: { stateMap, getStateById: (id: string) => stateMap[id] },
      label: { labelMap, getLabelById: (id: string) => labelMap[id] },
      memberRoot: { memberMap, getUserDetails: (id: string) => memberMap[id] },
    },
    issues: { addIssue: vi.fn(), getIssuesByIds: (ids: string[]) => ids.map((id) => ({ id })) },
    issueDetail: { relation: { extractRelationsFromIssues: vi.fn() } },
  } as unknown as IIssueRootStore;
  const constructors = {
    project: ProjectIssues,
    cycle: CycleIssues,
    module: ModuleIssues,
    view: ProjectViewIssues,
    workspace: WorkspaceIssues,
    profile: ProfileIssues,
    archived: ArchivedIssues,
  };
  const Constructor = constructors[scope as keyof typeof constructors] as unknown as new (
    root: IIssueRootStore,
    filters: IBaseIssueFilterStore
  ) => BaseIssuesStore;
  const store = new Constructor(root, filters);
  vi.spyOn(store, "fetchParentStats").mockImplementation(() => {});
  const api =
    scope === "workspace"
      ? vi.spyOn((store as WorkspaceIssues).workspaceService, "getViewIssues")
      : scope === "profile"
        ? vi.spyOn((store as ProfileIssues).userService, "getUserProfileIssues")
        : scope === "archived"
          ? vi.spyOn(store.issueArchiveService, "getArchivedIssues")
          : vi.spyOn(store.issueService, "getIssues");
  const fetch = (entity = "entity", loader: TLoader = "init-loader") => {
    if (store instanceof CycleIssues) return store.fetchIssues("ws", "project", loader, paginationOptions, entity);
    if (store instanceof ModuleIssues) return store.fetchIssues("ws", "project", loader, paginationOptions, entity);
    if (store instanceof ProjectViewIssues)
      return store.fetchIssues("ws", "project", entity, loader, paginationOptions);
    if (store instanceof ProfileIssues) return store.fetchIssues("ws", entity, loader, paginationOptions, "assigned");
    return (store as ProjectIssues | WorkspaceIssues | ArchivedIssues).fetchIssues(
      "ws",
      entity,
      loader,
      paginationOptions
    );
  };
  const next = (group?: string, subgroup?: string) => {
    if (store instanceof CycleIssues || store instanceof ModuleIssues || store instanceof ProjectViewIssues)
      return store.fetchNextIssues("ws", "project", "entity", group, subgroup);
    return (store as ProjectIssues | WorkspaceIssues | ProfileIssues | ArchivedIssues).fetchNextIssues(
      "ws",
      "entity",
      group,
      subgroup
    );
  };
  const realtime = () => {
    if (store instanceof CycleIssues || store instanceof ModuleIssues)
      return store.fetchIssuesWithExistingPagination("ws", "project", "mutation", "entity", true);
    if (store instanceof ProjectViewIssues)
      return store.fetchIssuesWithExistingPagination("ws", "project", "entity", "mutation", true);
    return (
      store as ProjectIssues | WorkspaceIssues | ProfileIssues | ArchivedIssues
    ).fetchIssuesWithExistingPagination("ws", "entity", "mutation", true);
  };
  return { store, root, filters, api, fetch, next, realtime };
}

describe.each(["project", "cycle", "module", "view", "workspace", "profile", "archived"])("%s refresh", (scope) => {
  it.each(["flat", "group", "subgroup"])(
    "loads unknown dictionaries once per project for %s snapshots",
    async (shape) => {
      const { store, root, api, fetch, realtime } = setup(scope);
      api.mockResolvedValueOnce(response("old"));
      await fetch();
      const issues = ["first", "second", "third"].map((id, index) => ({
        id,
        project_id: index === 2 ? "p2" : "p1",
        state_id: index === 2 ? "s2" : "s1",
        label_ids: [index === 2 ? "l2" : "l1"],
        assignee_ids: ["member"],
      }));
      const leaf = { results: issues, total_results: 3 };
      const snapshot = {
        ...response(""),
        results:
          shape === "flat"
            ? issues
            : { high: shape === "group" ? leaf : { results: { open: leaf }, total_results: 3 } },
        total_count: 3,
        next_page_results: false,
      } as unknown as TIssuesResponse;
      const dictionaries = vi.spyOn(store.issueService, "get").mockImplementation(
        async (path) =>
          ({
            data: path.endsWith("states/")
              ? [{ id: path.includes("p1") ? "s1" : "s2" }]
              : path.endsWith("issue-labels/")
                ? [{ id: path.includes("p1") ? "l1" : "l2" }]
                : [{ member: { id: "member", display_name: "Remote" }, created_at: "today" }],
          }) as never
      );
      api.mockResolvedValue(snapshot);
      await realtime();
      expect(dictionaries).toHaveBeenCalledTimes(5);
      expect(root.rootStore.state.stateMap).toEqual({ s1: { id: "s1" }, s2: { id: "s2" } });
      expect(root.rootStore.label.labelMap).toEqual({ l1: { id: "l1" }, l2: { id: "l2" } });
      expect(root.rootStore.memberRoot.memberMap).toEqual({
        member: { id: "member", display_name: "Remote", joining_date: "today" },
      });
      for (const call of dictionaries.mock.calls) expect(call[1]).toMatchObject({ signal: store.controller.signal });
      await realtime();
      expect(dictionaries).toHaveBeenCalledTimes(5);
    }
  );
  it.each(["abort", "revision"])("does not apply stale dictionaries or issues after %s", async (invalidation) => {
    const revision = vi.spyOn(issueSync, "revision", "get").mockReturnValue(0);
    const { store, root, api, fetch, realtime } = setup(scope);
    api.mockResolvedValueOnce(response("old"));
    await fetch();
    const previous = store.groupedIssueIds;
    api.mockResolvedValueOnce({
      ...response(""),
      results: [{ id: "new", project_id: "p1", state_id: "s1" }],
      next_page_results: false,
    } as unknown as TIssuesResponse);
    let resolve!: (value: unknown) => void;
    const pending = new Promise((res) => {
      resolve = res;
    });
    const dictionaries = vi.spyOn(store.issueService, "get").mockReturnValue(pending as never);
    const refreshing = realtime();
    await vi.waitFor(() => expect(dictionaries).toHaveBeenCalledOnce());
    if (invalidation === "abort") store.controller.abort();
    else revision.mockReturnValue(1);
    resolve({ data: [{ id: "s1" }] });
    await refreshing;
    expect(root.rootStore.state.stateMap).toEqual({});
    expect(store.groupedIssueIds).toBe(previous);
  });
  it.each(["list", "group", "subgroup", "calendar", "gantt"])(
    "replaces the complete loaded %s range atomically with fresh counts and IDs",
    async (layout) => {
      const paginationOptions = {
        ...options,
        perPageCount: 2,
        ...(layout === "calendar"
          ? { groupedBy: "target_date" as const, after: "2026-11-01", before: "2026-11-30" }
          : {}),
      };
      const { store, filters, api, fetch, next, realtime } = setup(scope, paginationOptions);
      if (layout === "group" || layout === "subgroup" || layout === "calendar")
        filters.issueFilters!.displayFilters!.group_by = "priority";
      if (layout === "subgroup") {
        filters.issueFilters!.displayFilters!.layout = EIssueLayoutTypes.KANBAN;
        filters.issueFilters!.displayFilters!.sub_group_by = "state";
      }
      if (layout === "calendar") filters.issueFilters!.displayFilters!.layout = EIssueLayoutTypes.CALENDAR;
      if (layout === "gantt") filters.issueFilters!.displayFilters!.layout = EIssueLayoutTypes.GANTT;
      const grouped = ["group", "subgroup", "calendar"].includes(layout);
      const page = (ids: string[], count: number, cursor: string, more: boolean): TIssuesResponse => {
        const leaf = { results: ids.map((id) => ({ id })), total_results: count };
        return {
          ...response(""),
          results: grouped
            ? { high: layout === "subgroup" ? { results: { open: leaf }, total_results: count } : leaf }
            : leaf.results,
          total_count: count,
          next_cursor: cursor,
          next_page_results: more,
        } as unknown as TIssuesResponse;
      };
      const ids = () => store.getIssueIds(grouped ? "high" : undefined, layout === "subgroup" ? "open" : undefined);
      api.mockResolvedValueOnce(page(["a", "deleted"], 8, "2:1:0", true));
      await fetch();
      api.mockResolvedValueOnce({
        ...page(["filtered-out", "d"], 8, "2:2:0", true),
        results: [{ id: "filtered-out" }, { id: "d" }],
      } as unknown as TIssuesResponse);
      await next(grouped ? "high" : undefined, layout === "subgroup" ? "open" : undefined);
      expect(ids()).toEqual(["a", "deleted", "filtered-out", "d"]);
      const visible = store.groupedIssueIds;
      const pending = deferred();
      api.mockResolvedValueOnce(page(["new", "a"], 5, "2:1:0", true)).mockReturnValueOnce(pending.promise);
      const refreshing = realtime();
      await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(4));
      expect(store.groupedIssueIds).toBe(visible);
      expect(store.getIssueLoader()).toBe("mutation");
      pending.resolve(page(["d", "e"], 5, "2:2:0", true));
      await refreshing;
      expect(ids()).toEqual(["new", "a", "d", "e"]);
      expect(
        store.getGroupIssueCount(grouped ? "high" : undefined, layout === "subgroup" ? "open" : undefined, false)
      ).toBe(5);
      expect(store.paginationOptions).toEqual(paginationOptions);
      const paramsIndex = scope === "workspace" ? 1 : 2;
      expect(api.mock.calls[3][paramsIndex]).toMatchObject({ cursor: "2:1:0", per_page: "2" });
      if (layout === "calendar")
        expect(api.mock.calls[3][paramsIndex]).toMatchObject({
          group_by: "target_date",
          target_date: "2026-11-01;after,2026-11-30;before",
        });
      expect(api.mock.calls[3][paramsIndex + 1]).toMatchObject({ signal: store.controller.signal });
      api.mockResolvedValueOnce(page(["last"], 5, "2:3:0", false));
      await next();
      expect(ids()).toEqual(["new", "a", "d", "e", "last"]);
    }
  );
  it("reads ranges larger than the server page limit using bounded pages", async () => {
    const { store, api, fetch, next, realtime } = setup(scope, { ...options, perPageCount: 1000 });
    const page = (prefix: string, size: number, cursor: string, more: boolean) =>
      ({
        ...response(""),
        results: Array.from({ length: size }, (_, index) => ({ id: `${prefix}-${index}` })),
        total_count: 1001,
        next_cursor: cursor,
        next_page_results: more,
      }) as unknown as TIssuesResponse;
    api.mockResolvedValueOnce(page("old", 1000, "1000:1:0", true));
    await fetch();
    api.mockResolvedValueOnce(page("last", 1, "1000:2:0", false));
    await next();
    api
      .mockResolvedValueOnce(page("fresh", 1000, "1000:1:0", true))
      .mockResolvedValueOnce(page("fresh-last", 1, "1000:2:0", false));
    await realtime();
    expect(store.getIssueIds()).toHaveLength(1001);
    expect(store.getIssueIds()).not.toContain("old-0");
    const paramsIndex = scope === "workspace" ? 1 : 2;
    expect(api.mock.calls[2][paramsIndex]).toMatchObject({ per_page: "1000", cursor: "1000:0:0" });
    expect(api.mock.calls[3][paramsIndex]).toMatchObject({ per_page: "1000", cursor: "1000:1:0" });
  });
  it("keeps the entire previous range when a later refresh page fails or is aborted", async () => {
    const { store, api, fetch, next, realtime } = setup(scope, { ...options, perPageCount: 1 });
    api.mockResolvedValueOnce(response("a"));
    await fetch();
    api.mockResolvedValueOnce(response("b"));
    await next();
    const visible = store.groupedIssueIds;
    api.mockResolvedValueOnce(response("new")).mockRejectedValueOnce(new Error("offline"));
    await expect(realtime()).rejects.toThrow("offline");
    expect(store.groupedIssueIds).toBe(visible);
    const pending = deferred();
    api.mockResolvedValueOnce(response("new")).mockReturnValueOnce(pending.promise);
    const refreshing = realtime();
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(6));
    store.controller.abort();
    pending.resolve(response("stale"));
    await refreshing;
    expect(store.groupedIssueIds).toBe(visible);
  });
  it("keeps data and applied grouping until a successful replacement, including zero results", async () => {
    const { store, filters, api, fetch } = setup(scope);
    api.mockResolvedValueOnce(response("old"));
    await fetch();
    const ids = store.groupedIssueIds;
    filters.issueFilters!.displayFilters!.group_by = "priority";
    expect(store.groupBy).toBeNull();
    const pending = deferred();
    api.mockReturnValueOnce(pending.promise);
    const refresh = fetch();
    expect(store.getIssueLoader()).toBe("mutation");
    expect(store.groupedIssueIds).toBe(ids);
    expect(store.groupBy).toBeNull();
    pending.resolve(response(""));
    await refresh;
    expect(store.groupBy).toBe("priority");
    expect(store.getGroupIssueCount(undefined, undefined, false)).toBe(0);
    expect(store.getIssueLoader()).toBeUndefined();
  });
  it("keeps an empty grouped result visible during its next refresh", async () => {
    const { store, filters, api, fetch } = setup(scope);
    filters.issueFilters!.displayFilters!.group_by = "priority";
    api.mockResolvedValueOnce({ ...response(""), results: {} });
    await fetch();
    const pending = deferred();
    api.mockReturnValueOnce(pending.promise);
    const refresh = fetch();
    expect(store.groupedIssueIds).toEqual({});
    expect(store.getIssueLoader()).toBe("mutation");
    expect(store.getGroupIssueCount(undefined, undefined, false)).toBe(0);
    pending.resolve(response(""));
    await refresh;
  });
  it("applies swimlane grouping with the matching response", async () => {
    const { store, filters, api, fetch } = setup(scope);
    filters.issueFilters!.displayFilters!.layout = EIssueLayoutTypes.KANBAN;
    filters.issueFilters!.displayFilters!.group_by = "priority";
    api.mockResolvedValueOnce({
      ...response("old"),
      results: { high: { results: [{ id: "old" }], total_results: 1 } },
    } as unknown as TIssuesResponse);
    await fetch();
    filters.issueFilters!.displayFilters!.sub_group_by = "state";
    const pending = deferred();
    api.mockReturnValueOnce(pending.promise);
    const refresh = fetch();
    expect(store.subGroupBy).toBeNull();
    expect(store.getIssueIds("high")).toEqual(["old"]);
    pending.resolve({
      ...response("new"),
      results: { high: { results: { open: { results: [{ id: "new" }], total_results: 1 } }, total_results: 1 } },
    } as unknown as TIssuesResponse);
    await refresh;
    expect(store.subGroupBy).toBe("state");
    expect(store.getIssueIds("high", "open")).toEqual(["new"]);
  });
  it("clears on first load and entity switch, but keeps data on refresh failure", async () => {
    const { store, api, fetch } = setup(scope);
    const initial = deferred();
    api.mockReturnValueOnce(initial.promise);
    const loading = fetch();
    expect(store.groupedIssueIds).toBeUndefined();
    expect(store.getIssueLoader()).toBe("init-loader");
    initial.resolve(response("old"));
    await loading;
    const ids = store.groupedIssueIds;
    api.mockRejectedValueOnce(new Error("offline"));
    await expect(fetch()).rejects.toThrow("offline");
    expect(store.groupedIssueIds).toBe(ids);
    expect(store.getIssueLoader()).toBeUndefined();
    const next = deferred();
    api.mockReturnValueOnce(next.promise);
    const switched = fetch("other");
    expect(store.groupedIssueIds).toBeUndefined();
    expect(store.getIssueLoader()).toBe("init-loader");
    next.resolve(response("other"));
    await switched;
  });
  it("retains failed grouping and blocks pagination until it matches", async () => {
    const { store, filters, api, fetch, next } = setup(scope);
    api.mockResolvedValueOnce(response("old"));
    await fetch();
    filters.issueFilters!.displayFilters!.group_by = "priority";
    api.mockRejectedValueOnce(new Error("offline"));
    await expect(fetch()).rejects.toThrow("offline");
    expect(store.groupBy).toBeNull();
    expect(store.getIssueIds()).toEqual(["old"]);
    await next();
    expect(api).toHaveBeenCalledTimes(2);
  });
  it("ignores a page that completes after replacement", async () => {
    const { store, api, fetch, next } = setup(scope);
    api.mockResolvedValueOnce(response("old"));
    await fetch();
    const page = deferred();
    api.mockReturnValueOnce(page.promise);
    const paginating = next();
    api.mockResolvedValueOnce(response("new"));
    await fetch();
    page.resolve(response("stale-page"));
    await paginating;
    expect(store.getIssueIds()).toEqual(["new"]);
  });
  it.each(["resolve", "reject"])("ignores obsolete request %s without clearing the latest loader", async (outcome) => {
    const { store, api, fetch } = setup(scope);
    api.mockResolvedValueOnce(response("old"));
    await fetch();
    const first = deferred();
    const second = deferred();
    api.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const stale = fetch();
    const latest = fetch();
    if (outcome === "resolve") first.resolve(response("stale"));
    else first.reject(new Error("cancelled"));
    await stale;
    expect(store.getIssueLoader()).toBe("mutation");
    expect(store.getIssueIds()).toEqual(["old"]);
    second.resolve(response("latest"));
    await latest;
    expect(store.getIssueIds()).toEqual(["latest"]);
  });
});
