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
  const groupsById = new Map<string, ProjectLayoutGroup[]>();
  for (const group of groups) {
    const matches = groupsById.get(group.id);
    if (matches) matches.push(group);
    else groupsById.set(group.id, [group]);
  }
  const phasesByStatusId = new Map<string, string>();
  for (const status of statuses) {
    if (!phasesByStatusId.has(status.id)) phasesByStatusId.set(status.id, status.group);
  }
  const unassigned: IProject[] = [];
  const defaultStatus = statuses.find((status) => status.is_default);
  for (const project of projects) {
    const statusId = project.status ?? defaultStatus?.id;
    const phase = statusId === undefined ? undefined : phasesByStatusId.get(statusId);
    const ids = by === "labels" ? new Set(project.labels ?? []) : new Set(phase === undefined ? [] : [phase]);
    let assigned = false;
    for (const id of ids) {
      const matches = groupsById.get(id);
      if (!matches) continue;
      for (const group of matches) group.projects.push(project);
      assigned = true;
    }
    if (!assigned) unassigned.push(project);
  }
  groups.push({ id: "unassigned", projects: unassigned });
  return groups;
}
