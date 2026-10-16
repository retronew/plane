import type { TProjectWorkflow } from "@plane/types";

export function workflowIsActive(workflow?: TProjectWorkflow) {
  return !!workflow?.enabled && workflow.is_active;
}

export function workflowAllowsCreation(workflow: TProjectWorkflow | undefined, stateId: string) {
  return !workflowIsActive(workflow) || workflow!.states.some((state) => state.id === stateId && state.allow_creation);
}

export function workflowAllowsTransition(
  workflow: TProjectWorkflow | undefined,
  sourceId: string,
  destinationId: string,
  userId?: string
) {
  if (!workflowIsActive(workflow) || sourceId === destinationId) return true;
  const rules = workflow!.transitions.filter((rule) => rule.source_id === sourceId);
  if (!rules.length) return true;
  return rules.some(
    (rule) =>
      rule.destination_id === destinationId &&
      (!rule.member_ids.length || (!!userId && rule.member_ids.includes(userId)))
  );
}

export function getWorkflowErrorCode(error: unknown, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  if (!error || typeof error !== "object") return undefined;
  const value = error as Record<string, unknown> & { response?: { data?: unknown }; data?: unknown };
  for (const field of ["workflow", "state_id", "initial_state_id", "source_id", "destination_id", "member_ids"]) {
    const candidate = Array.isArray(value[field]) ? value[field][0] : value[field];
    if (typeof candidate === "string" && /^WORKFLOW_[A-Z_]+$/.test(candidate)) return candidate;
  }
  return getWorkflowErrorCode(value.response?.data ?? value.data, depth + 1);
}
