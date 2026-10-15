import type { IProject, TProject, TProjectGrouping } from "@plane/types";
import type { ProjectCategory } from "@/services/workspace-configuration.service";
import { groupProjects } from "./layout-utils";

export type ProjectLayoutGroup = {
  id: string;
  projects: IProject[];
  status?: ProjectCategory;
  label?: ProjectCategory;
  phase?: string;
  priority?: NonNullable<IProject["priority"]>;
  creator?: string;
};

/** Return null when the server cannot create in this group (creator is read-only; missing statuses fall back). */
export function getProjectGroupCreateDefaults(
  group: ProjectLayoutGroup,
  by: TProjectGrouping,
  statuses: ProjectCategory[],
  currentUserId?: string
): Partial<TProject> | null {
  if (by === "created_by") return group.creator === currentUserId ? {} : null;
  if (by === "priority") return { priority: group.priority ?? "none" };
  if (by === "labels") return { labels: group.label ? [group.label.id] : [] };
  const candidates = group.phase ? statuses.filter((status) => status.group === group.phase) : [];
  const status = group.status ?? candidates.find((entry) => entry.is_default) ?? candidates[0];
  return status ? { status: status.id } : statuses.length ? null : {};
}

/** Membership is derived without mutating projects. Multi-label projects belong to each matching group. */
export function groupProjectRecords(
  projects: IProject[],
  statuses: ProjectCategory[],
  labels: ProjectCategory[],
  by: TProjectGrouping
): ProjectLayoutGroup[] {
  if (by === "status") return groupProjects(projects, statuses);
  if (by === "priority")
    return (["urgent", "high", "medium", "low", "none"] as const).map((priority) => ({
      id: priority,
      priority,
      projects: projects.filter((project) => (project.priority ?? "none") === priority),
    }));
  if (by === "created_by")
    return [...new Set(projects.map((project) => project.created_by ?? ""))].map((creator) => ({
      id: creator || "unassigned",
      creator,
      projects: projects.filter((project) => (project.created_by ?? "") === creator),
    }));
  const groups: ProjectLayoutGroup[] =
    by === "labels"
      ? labels.map((label) => ({ id: label.id, label, projects: [] }))
      : [...new Set(statuses.map((status) => status.group))].map((phase) => ({ id: phase, phase, projects: [] }));
  const unassigned: IProject[] = [];
  const defaultStatus = statuses.find((status) => status.is_default);
  for (const project of projects) {
    const ids =
      by === "labels"
        ? (project.labels ?? [])
        : [statuses.find((status) => status.id === (project.status ?? defaultStatus?.id))?.group];
    const matches = groups.filter((group) => ids.includes(group.id));
    if (matches.length) for (const group of matches) group.projects.push(project);
    else unassigned.push(project);
  }
  groups.push({ id: "unassigned", projects: unassigned });
  return groups;
}
