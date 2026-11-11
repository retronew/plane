import type { TPeekIssue } from "@/store/issue/issue-details/root.store";

const peekKeys = ["peekId", "peekProjectId", "peekArchived", "peekNestingLevel"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readIssuePeekUrl(
  search: string,
  workspaceSlug: string | undefined,
  projectId?: string
): TPeekIssue | undefined {
  const params = new URLSearchParams(search);
  const issueId = params.get("peekId");
  const peekProjectId = params.get("peekProjectId") ?? projectId;
  if (!workspaceSlug || !issueId || !peekProjectId || !uuidPattern.test(issueId) || !uuidPattern.test(peekProjectId))
    return undefined;
  const nesting = params.get("peekNestingLevel");
  return {
    workspaceSlug,
    projectId: peekProjectId,
    issueId,
    isArchived: params.get("peekArchived") === "1",
    ...(nesting && /^\d+$/.test(nesting) && Number.isSafeInteger(Number(nesting))
      ? { nestingLevel: Number(nesting) }
      : {}),
  };
}

/** Only offer Back for another task reached inside this workspace's peek navigation. */
export function readIssuePeekBack(state: unknown, current: TPeekIssue): TPeekIssue | undefined {
  if (!state || typeof state !== "object" || !("issuePeekBack" in state)) return undefined;
  const previous = state.issuePeekBack;
  if (!previous || typeof previous !== "object") return undefined;
  if (
    !("workspaceSlug" in previous) ||
    previous.workspaceSlug !== current.workspaceSlug ||
    !("projectId" in previous) ||
    typeof previous.projectId !== "string" ||
    !uuidPattern.test(previous.projectId) ||
    !("issueId" in previous) ||
    typeof previous.issueId !== "string" ||
    !uuidPattern.test(previous.issueId) ||
    previous.issueId === current.issueId
  )
    return undefined;
  return {
    workspaceSlug: current.workspaceSlug,
    projectId: previous.projectId,
    issueId: previous.issueId,
  };
}

export function buildIssuePeekUrl(
  location: { pathname: string; search: string; hash: string },
  peekIssue: TPeekIssue | undefined
): string {
  const params = new URLSearchParams(location.search);
  for (const key of peekKeys) params.delete(key);
  if (peekIssue) {
    params.set("peekId", peekIssue.issueId);
    params.set("peekProjectId", peekIssue.projectId);
    if (peekIssue.isArchived) params.set("peekArchived", "1");
    if (peekIssue.nestingLevel !== undefined) params.set("peekNestingLevel", String(peekIssue.nestingLevel));
  }
  return `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`;
}
