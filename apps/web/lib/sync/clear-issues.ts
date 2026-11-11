import type { IIssueRootStore } from "@/store/issue/root.store";

/** Drop cached entities and list references immediately when access is withdrawn. */
export function clearRevokedIssues(store: IIssueRootStore, projectId?: string) {
  const lists = [
    store.projectIssues,
    store.cycleIssues,
    store.moduleIssues,
    store.projectViewIssues,
    store.workspaceIssues,
    store.profileIssues,
    store.archivedIssues,
    store.teamIssues,
    store.teamViewIssues,
    store.teamProjectWorkItems,
  ];
  // A response started before revocation must not repopulate the cleared lists.
  // The shared API revision guard also rejects those responses.
  for (const list of lists) {
    (list as typeof list & { controller?: AbortController }).controller?.abort();
  }
  const ids = Object.values(store.issues.issuesMap)
    .filter((issue) => !projectId || issue.project_id === projectId)
    .map((issue) => issue.id);
  for (const id of ids) {
    for (const list of lists) list.removeIssueFromList(id);
    store.issues.removeIssue(id);
  }
  const peek = store.issueDetail.peekIssue;
  if (peek && (!projectId || peek.projectId === projectId)) store.issueDetail.setPeekIssue(undefined);
}
