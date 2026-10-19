import type { TProjectIssueType } from "@plane/types";

/** Undefined keeps the server default; null explicitly means an untyped work item. */
export function hierarchyTypeSearchParam(typeId: string | null | undefined) {
  return typeId === null ? "null" : typeId;
}

export function issueTypeLevel(types: TProjectIssueType[], typeId: string | null | undefined) {
  if (typeId === null) return 0;
  const type = typeId === undefined ? types.find((item) => item.is_default) : types.find((item) => item.id === typeId);
  return type ? (type.level ?? 0) : undefined;
}

export function legalChildTypeIds(types: TProjectIssueType[], parentTypeId: string | null | undefined) {
  const level = issueTypeLevel(types, parentTypeId);
  if (level === undefined) return [];
  return types.filter((type) => type.is_active && issueTypeLevel(types, type.id) === level - 1).map((type) => type.id);
}

const hierarchyErrorKeys: Record<string, string> = {
  HIERARCHY_INVALID_LEVEL: "web.issue_hierarchy.invalid_level",
  HIERARCHY_CYCLE: "web.issue_hierarchy.cycle",
  HIERARCHY_CROSS_PROJECT: "web.issue_hierarchy.cross_project",
  HIERARCHY_INVALID_PARENT: "web.issue_hierarchy.invalid_parent",
  HIERARCHY_CHILDREN_CONFLICT: "web.issue_hierarchy.children_conflict",
  HIERARCHY_INVALID_TYPE: "web.issue_hierarchy.invalid_type",
  HIERARCHY_INVALID_ISSUE: "web.issue_hierarchy.invalid_issue",
  HIERARCHY_PROJECT_CHANGED: "web.issue_hierarchy.project_changed",
};

export function hierarchyErrorKey(error: unknown, fallback = "web.issue_hierarchy.save_failed", depth = 0): string {
  if (depth > 4 || !error || typeof error !== "object") return fallback;
  const value = error as Record<string, unknown> & { response?: { data?: unknown }; data?: unknown };
  for (const field of ["hierarchy", "parent_id", "type_id", "detail", "code"]) {
    const code = Array.isArray(value[field]) ? value[field][0] : value[field];
    if (typeof code === "string" && hierarchyErrorKeys[code]) return hierarchyErrorKeys[code];
  }
  return hierarchyErrorKey(value.response?.data ?? value.data, fallback, depth + 1);
}
