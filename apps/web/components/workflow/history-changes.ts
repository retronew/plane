import type { TWorkflowRuleSnapshot } from "@plane/types";

export function memberSnapshotChanges(before?: TWorkflowRuleSnapshot | null, after?: TWorkflowRuleSnapshot | null) {
  if (!before?.members || !after?.members) return undefined;
  return {
    added: after.members.filter((member) => !before.members!.some((old) => old.id === member.id)),
    removed: before.members.filter((member) => !after.members!.some((next) => next.id === member.id)),
  };
}
