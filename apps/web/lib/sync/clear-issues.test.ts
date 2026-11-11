import { describe, expect, it, vi } from "vitest";
import type { IIssueRootStore } from "@/store/issue/root.store";
import { clearRevokedIssues } from "./clear-issues";

function fixture() {
  const list = { removeIssueFromList: vi.fn(), controller: new AbortController() };
  const removeIssue = vi.fn();
  const setPeekIssue = vi.fn();
  const store = {
    issues: { issuesMap: { a: { id: "a", project_id: "private" }, b: { id: "b", project_id: "other" } }, removeIssue },
    issueDetail: { peekIssue: { issueId: "a", projectId: "private" }, setPeekIssue },
    projectIssues: list,
    cycleIssues: list,
    moduleIssues: list,
    projectViewIssues: list,
    workspaceIssues: list,
    profileIssues: list,
    archivedIssues: list,
    teamIssues: list,
    teamViewIssues: list,
    teamProjectWorkItems: list,
  } as unknown as IIssueRootStore;
  return { store, list, removeIssue, setPeekIssue };
}

describe("revoked task access", () => {
  it("removes only the revoked project's entities and references and closes its peek", () => {
    const { store, list, removeIssue, setPeekIssue } = fixture();
    clearRevokedIssues(store, "private");
    expect(removeIssue).toHaveBeenCalledExactlyOnceWith("a");
    expect(list.removeIssueFromList).toHaveBeenCalledTimes(10);
    expect(list.removeIssueFromList).toHaveBeenCalledWith("a");
    expect(list.controller.signal.aborted).toBe(true);
    expect(setPeekIssue).toHaveBeenCalledExactlyOnceWith(undefined);
  });
  it("cleans the full cache when workspace access is lost", () => {
    const { store, removeIssue } = fixture();
    clearRevokedIssues(store);
    expect(removeIssue.mock.calls).toEqual([["a"], ["b"]]);
  });
  it("keeps an unrelated open task when another project is revoked", () => {
    const { store, setPeekIssue } = fixture();
    clearRevokedIssues(store, "other");
    expect(setPeekIssue).not.toHaveBeenCalled();
  });
});
