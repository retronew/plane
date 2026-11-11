import { autorun, runInAction } from "mobx";
import { describe, expect, it, vi } from "vitest";
import type { TIssue, TIssueSubIssues, TIssueServiceType } from "@plane/types";
import type { IIssueDetail } from "./root.store";
import { IssueSubIssuesStore } from "./sub_issues.store";

vi.mock("@/lib/store-context", () => ({ store: {} }));
vi.mock("@/services/issue", () => ({
  IssueService: class {
    subIssues = vi.fn();
  },
}));

const issue = (id: string, parentId: string, overrides: Partial<TIssue> = {}): TIssue =>
  ({
    id,
    parent_id: parentId,
    project_id: "project",
    created_at: "2026-01-01",
    priority: "low",
    ...overrides,
  }) as TIssue;

function setup(items: TIssue[] = []) {
  const issuesMap = Object.fromEntries(items.map((item) => [item.id, item]));
  const issues = {
    issuesMap,
    addIssue: vi.fn((incoming: TIssue[]) => {
      for (const item of incoming) issuesMap[item.id] = item;
    }),
    updateIssue: vi.fn((id: string, data: Partial<TIssue>) => {
      issuesMap[id] = { ...issuesMap[id], id, ...data };
    }),
    getIssuesByIds: (ids: string[] = []) =>
      ids.map((id) => issuesMap[id]).filter((item) => !!item && !item.archived_at),
  };
  const root = { rootIssueStore: { issues } } as unknown as IIssueDetail;
  const store = new IssueSubIssuesStore(root, "issues" as TIssueServiceType);
  return { store, issues };
}

function response(items: TIssue[], completed: string[] = []): TIssueSubIssues {
  return {
    sub_issues: items,
    state_distribution: { backlog: [], unstarted: [], started: [], completed, cancelled: [] },
  };
}

const descendants = [
  issue("a", "root"),
  issue("b", "root", { created_at: "2026-02-01", priority: "high" }),
  issue("c", "a"),
  issue("d", "a", { created_at: "2026-03-01" }),
  issue("deep", "c", { priority: "urgent" }),
];

async function loaded() {
  const result = setup();
  vi.mocked(result.store.issueService.subIssues).mockResolvedValue(response(descendants, ["a"]));
  await result.store.fetchSubIssues("workspace", "project", "root");
  return result;
}

describe("sub-work item hierarchy", () => {
  it("loads the whole tree once, sorts siblings and toggles all descendants together", async () => {
    const { store } = await loaded();
    expect(store.issueService.subIssues).toHaveBeenCalledWith("workspace", "project", "root", {
      include_descendants: true,
    });
    expect(store.filters.getVisibleSubWorkItemIds("root", "root")).toEqual(["b", "a"]);
    expect(store.filters.getVisibleSubWorkItemIds("a", "root")).toEqual(["d", "c"]);
    expect(store.filters.getVisibleSubWorkItemIds("c", "root")).toEqual(["deep"]);
    expect(store.filters.getFilteredSubWorkItems("root", {})).toHaveLength(5);
    store.filters.subIssueFilters.root.displayFilters = { sub_issue: false };
    expect(store.filters.getVisibleSubWorkItemIds("root", "root")).toEqual(["b", "a"]);
    expect(store.filters.getVisibleSubWorkItemIds("a", "root")).toEqual([]);
    expect(store.filters.getFilteredSubWorkItems("root", {})).toHaveLength(2);
    store.filters.subIssueFilters.root.displayFilters = { sub_issue: true };
    expect(store.filters.getVisibleSubWorkItemIds("c", "root")).toEqual(["deep"]);
  });

  it("shares the visible tree between observed levels and invalidates it when filters change", async () => {
    const { store, issues } = await loaded();
    const reads = vi.spyOn(issues, "getIssuesByIds");
    let visible: string[][] = [];
    const dispose = autorun(() => {
      visible = ["root", "a", "c"].map((id) => store.filters.getVisibleSubWorkItemIds(id, "root"));
    });
    try {
      expect(visible).toEqual([["b", "a"], ["d", "c"], ["deep"]]);
      // One traversal visits the root and five descendant buckets, shared by all three levels.
      expect(reads).toHaveBeenCalledTimes(6);
      runInAction(() => {
        store.filters.subIssueFilters.root.filters = { priority: ["urgent"] };
      });
      expect(visible).toEqual([["a"], ["c"], ["deep"]]);
      runInAction(() => {
        store.filters.subIssueFilters.root.displayFilters = { sub_issue: false };
      });
      expect(visible).toEqual([[], [], []]);
    } finally {
      dispose();
    }
  });

  it("keeps ancestor context for deep matches but returns only actual matches for empty states", async () => {
    const { store } = await loaded();
    const filters = store.filters.getSubIssueFilters("root");
    filters.filters = { priority: ["urgent"] };
    filters.displayFilters = { group_by: "priority", order_by: "-created_at" };
    expect(store.filters.getFilteredSubWorkItems("root", filters.filters).map((item) => item.id)).toEqual(["deep"]);
    expect(store.filters.getGroupedSubWorkItems("root")).toEqual({ low: ["a"] });
    expect(store.filters.getVisibleSubWorkItemIds("a", "root")).toEqual(["c"]);
    expect(store.filters.getVisibleSubWorkItemIds("c", "root")).toEqual(["deep"]);
    filters.displayFilters.sub_issue = false;
    expect(store.filters.getFilteredSubWorkItems("root", filters.filters)).toEqual([]);
    expect(store.filters.getGroupedSubWorkItems("root")).toEqual({});
  });

  it("deduplicates repeated links and terminates cycles without promoting inaccessible paths", async () => {
    const { store } = await loaded();
    store.subIssues.root = ["a", "a", "missing"];
    store.subIssues.a = ["c", "root"];
    store.subIssues.c = ["a", "deep"];
    expect(store.filters.getFilteredSubWorkItems("root", {}).map((item) => item.id)).toEqual(["a", "c", "deep"]);
    expect(store.filters.getVisibleSubWorkItemIds("c", "root")).toEqual(["deep"]);
  });

  it("refreshes all buckets, clears removed branches and keeps root statistics direct", async () => {
    const { store, issues } = await loaded();
    expect(issues.issuesMap.root.sub_issues_count).toBe(2);
    expect(store.stateDistributionByIssueId("root")?.completed).toEqual(["a"]);
    store.subIssues.unrelated = ["other"];
    vi.mocked(store.issueService.subIssues).mockResolvedValue(response([issue("a", "root")]));
    await store.fetchSubIssues("workspace", "project", "root");
    expect(store.subIssues.root).toEqual(["a"]);
    expect(store.subIssues.a).toEqual([]);
    expect(store.subIssues.c).toBeUndefined();
    expect(store.subIssues.deep).toBeUndefined();
    expect(store.subIssues.unrelated).toEqual(["other"]);
    expect(store.filters.getFilteredSubWorkItems("root", {}).map((item) => item.id)).toEqual(["a"]);
    expect(issues.issuesMap.root.sub_issues_count).toBe(1);
    expect(store.stateDistributionByIssueId("root")?.completed).toEqual([]);
  });

  it("excludes draft, archived and orphan branches without fabricating ancestors", async () => {
    const { store } = setup();
    vi.mocked(store.issueService.subIssues).mockResolvedValue(
      response([
        issue("draft", "root", { is_draft: true }),
        issue("draft-child", "draft"),
        issue("archived", "root", { archived_at: "2026-01-01" }),
        issue("archived-child", "archived"),
        issue("orphan", "hidden"),
        issue("visible", "root"),
      ])
    );
    await store.fetchSubIssues("workspace", "project", "root");
    expect(store.subIssues.root).toEqual(["visible"]);
    expect(store.filters.getFilteredSubWorkItems("root", {}).map((item) => item.id)).toEqual(["visible"]);
  });
});
