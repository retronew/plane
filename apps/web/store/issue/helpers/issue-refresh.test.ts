import { afterEach, describe, expect, it, vi } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import type { TIssuesResponse, TLoader } from "@plane/types";
import type { IIssueRootStore } from "../root.store";
import type { IBaseIssueFilterStore } from "./issue-filter-helper.store";
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

function setup(scope: string) {
  const filters = {
    issueFilters: { displayFilters: { layout: EIssueLayoutTypes.LIST, group_by: null, sub_group_by: null } },
    getFilterParams: () => ({}),
  } as unknown as IBaseIssueFilterStore;
  const root = {
    rootStore: { router: {} },
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
    if (store instanceof CycleIssues) return store.fetchIssues("ws", "project", loader, options, entity);
    if (store instanceof ModuleIssues) return store.fetchIssues("ws", "project", loader, options, entity);
    if (store instanceof ProjectViewIssues) return store.fetchIssues("ws", "project", entity, loader, options);
    if (store instanceof ProfileIssues) return store.fetchIssues("ws", entity, loader, options, "assigned");
    return (store as ProjectIssues | WorkspaceIssues | ArchivedIssues).fetchIssues("ws", entity, loader, options);
  };
  const next = () => {
    if (store instanceof CycleIssues || store instanceof ModuleIssues || store instanceof ProjectViewIssues)
      return store.fetchNextIssues("ws", "project", "entity");
    return (store as ProjectIssues | WorkspaceIssues | ProfileIssues | ArchivedIssues).fetchNextIssues("ws", "entity");
  };
  return { store, filters, api, fetch, next };
}

describe.each(["project", "cycle", "module", "view", "workspace", "profile", "archived"])("%s refresh", (scope) => {
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
