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
