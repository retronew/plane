import type { IBlockUpdateDependencyData, TIssueMap } from "@plane/types";

/** Workspace timelines may contain work items from several projects. */
export async function updateGanttIssueDates(
  updates: IBlockUpdateDependencyData[],
  issueMap: TIssueMap,
  canEdit: (issueId: string) => boolean,
  save: (projectId: string, updates: IBlockUpdateDependencyData[]) => Promise<void>
): Promise<void> {
  const byProject = new Map<string, IBlockUpdateDependencyData[]>();
  for (const update of updates) {
    const projectId = issueMap[update.id]?.project_id;
    if (!projectId || !canEdit(update.id)) continue;
    byProject.set(projectId, [...(byProject.get(projectId) ?? []), update]);
  }
  await Promise.all([...byProject].map(([projectId, projectUpdates]) => save(projectId, projectUpdates)));
}
