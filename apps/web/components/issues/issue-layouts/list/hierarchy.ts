import type { TIssueMap } from "@plane/types";

/** Order only the current group's results: hierarchy must not pull in filtered-out tasks. */
export function buildIssueHierarchy(issueIds: string[], issuesMap: TIssueMap) {
  const ids = [...new Set(issueIds)];
  const visible = new Set(ids);
  const children = new Map<string, string[]>();
  for (const id of ids) {
    const parentId = issuesMap[id]?.parent_id;
    if (parentId && parentId !== id && visible.has(parentId)) {
      const siblings = children.get(parentId) ?? [];
      siblings.push(id);
      children.set(parentId, siblings);
    }
  }
  const rows: { id: string; level: number; branches: boolean[] }[] = [];
  const visited = new Set<string>();
  const visit = (id: string, level: number, branches: boolean[] = []) => {
    if (visited.has(id)) return;
    visited.add(id);
    rows.push({ id, level, branches });
    const siblings = children.get(id) ?? [];
    siblings.forEach((child, index) => visit(child, level + 1, [...branches, index < siblings.length - 1]));
  };
  for (const id of ids) {
    const parentId = issuesMap[id]?.parent_id;
    if (!parentId || !visible.has(parentId) || parentId === id) visit(id, 0);
  }
  // Defensive fallback for malformed cycles: every visible task still appears once.
  for (const id of ids) visit(id, 0);
  return rows;
}
