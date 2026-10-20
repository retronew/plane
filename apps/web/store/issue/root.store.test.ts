import { expect, it, vi } from "vitest";
import { autorun, configure, observable, runInAction } from "mobx";
import type { RootStore } from "@/store/root.store";
import { IssueRootStore } from "./root.store";
vi.mock("@/store/issue/issue-details/root.store", () => ({ IssueDetail: vi.fn(function () {}) }));
vi.mock("./archived", () => ({ ArchivedIssuesFilter: vi.fn(function () {}), ArchivedIssues: vi.fn(function () {}) }));
vi.mock("./cycle", () => ({ CycleIssuesFilter: vi.fn(function () {}), CycleIssues: vi.fn(function () {}) }));
vi.mock("./issue.store", () => ({ IssueStore: vi.fn(function () {}) }));
vi.mock("./issue_calendar_view.store", () => ({ CalendarStore: vi.fn(function () {}) }));
vi.mock("./issue_kanban_view.store", () => ({ IssueKanBanViewStore: vi.fn(function () {}) }));
vi.mock("./module", () => ({ ModuleIssuesFilter: vi.fn(function () {}), ModuleIssues: vi.fn(function () {}) }));
vi.mock("./profile", () => ({ ProfileIssuesFilter: vi.fn(function () {}), ProfileIssues: vi.fn(function () {}) }));
vi.mock("./project", () => ({ ProjectIssuesFilter: vi.fn(function () {}), ProjectIssues: vi.fn(function () {}) }));
vi.mock("./project-views", () => ({
  ProjectViewIssuesFilter: vi.fn(function () {}),
  ProjectViewIssues: vi.fn(function () {}),
}));
vi.mock("./workspace", () => ({ WorkspaceIssuesFilter: vi.fn(function () {}) }));
vi.mock("./workspace/issue.store", () => ({ WorkspaceIssues: vi.fn(function () {}) }));
vi.mock("./workspace-draft", () => ({
  WorkspaceDraftIssues: vi.fn(function () {}),
  WorkspaceDraftIssuesFilter: vi.fn(function () {}),
}));

it("tracks route changes and clears route fields without modifying observed state outside actions", () => {
  configure({ enforceActions: "always" });
  const router = observable<{ workspaceSlug: string; projectId: string | undefined; teamspaceId: undefined }>({
    workspaceSlug: "first",
    projectId: "project",
    teamspaceId: undefined,
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const store = new IssueRootStore({ router } as unknown as RootStore);
  const dispose = autorun(() => {
    void store.workspaceSlug;
    void store.projectId;
  });
  try {
    expect(store.workspaceSlug).toBe("first");
    expect(store.projectId).toBe("project");
    runInAction(() => {
      router.workspaceSlug = "second";
      router.projectId = "other";
    });
    expect(store.workspaceSlug).toBe("second");
    expect(store.projectId).toBe("other");
    runInAction(() => {
      router.projectId = undefined;
    });
    expect(store.projectId).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  } finally {
    dispose();
    warn.mockRestore();
    configure({ enforceActions: "observed" });
  }
});
