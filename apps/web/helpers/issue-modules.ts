import { xor } from "lodash-es";

/** Keep the symmetric difference's order and duplicate semantics for module updates. */
export function getIssueModuleChanges(currentIds: string[] | null | undefined, nextIds: string[]) {
  const current = new Set(currentIds);
  const modulesToAdd: string[] = [];
  const modulesToRemove: string[] = [];
  for (const id of xor(currentIds, nextIds)) {
    if (current.has(id)) modulesToRemove.push(id);
    else modulesToAdd.push(id);
  }
  return { modulesToAdd, modulesToRemove };
}
