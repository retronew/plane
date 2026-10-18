import type { IProject } from "@plane/types";
import type { ProjectCategory } from "@/services/workspace-configuration.service";

/** Keep configured status order and project sort order; never lose legacy/missing statuses. */
export function groupProjects(projects: IProject[], statuses: ProjectCategory[]) {
  const groups: { id: string; status: ProjectCategory | undefined; projects: IProject[] }[] = statuses.map(
    (status) => ({ id: status.id, status, projects: [] as IProject[] })
  );
  const groupsById = new Map<string, (typeof groups)[number]>();
  for (const group of groups) {
    if (!groupsById.has(group.id)) groupsById.set(group.id, group);
  }
  const defaultStatus = statuses.find((status) => status.is_default);
  const ungrouped: IProject[] = [];
  for (const project of projects) {
    const id = project.status ?? defaultStatus?.id;
    const group = id === undefined ? undefined : groupsById.get(id);
    if (group) group.projects.push(project);
    else ungrouped.push(project);
  }
  if (ungrouped.length || !groups.length) groups.push({ id: "unassigned", status: undefined, projects: ungrouped });
  return groups;
}
