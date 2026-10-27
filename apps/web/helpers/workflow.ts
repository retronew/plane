import type { TProjectWorkflow } from "@plane/types";

export function workflowIsActive(workflow?: TProjectWorkflow) {
  return !!workflow?.enabled && workflow.is_active;
}

export function workflowAllowsCreation(
  workflow: TProjectWorkflow | undefined,
  stateId: string,
  state?: { allow_new_work_items?: boolean }
) {
  return (
    state?.allow_new_work_items !== false &&
    (!workflowIsActive(workflow) || workflow!.states.some((entry) => entry.id === stateId && entry.allow_creation))
  );
}

export function workflowAllowsTransition(
  workflow: TProjectWorkflow | undefined,
  sourceId: string,
  destinationId: string,
  userId?: string
) {
  if (!workflowIsActive(workflow) || sourceId === destinationId) return true;
  if (!workflow!.states.some((state) => state.id === destinationId)) return false;
  const rules = workflow!.transitions.filter((rule) => rule.source_id === sourceId);
  if (!rules.length) return true;
  return rules.some(
    (rule) =>
      rule.kind !== "approval" &&
      rule.destination_id === destinationId &&
      (!rule.member_ids.length || (!!userId && rule.member_ids.includes(userId)))
  );
}

export function getWorkflowErrorReason(error: unknown, depth = 0): string | undefined {
  if (depth > 4 || !error || typeof error !== "object") return undefined;
  const value = error as Record<string, unknown> & { response?: { data?: unknown }; data?: unknown };
  if (typeof value.reason === "string" && value.reason.trim()) return value.reason.slice(0, 500);
  return getWorkflowErrorReason(value.response?.data ?? value.data, depth + 1);
}

export function getWorkflowErrorCode(error: unknown, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  if (!error || typeof error !== "object") return undefined;
  const value = error as Record<string, unknown> & { response?: { data?: unknown }; data?: unknown };
  for (const field of [
    "code",
    "error",
    "detail",
    "workflow",
    "state_id",
    "type_id",
    "initial_state_id",
    "source_id",
    "destination_id",
    "member_ids",
    "non_field_errors",
  ]) {
    const candidate = Array.isArray(value[field]) ? value[field][0] : value[field];
    if (typeof candidate === "string" && /^WORKFLOW_[A-Z_]+$/.test(candidate)) return candidate;
  }
  return getWorkflowErrorCode(value.response?.data ?? value.data, depth + 1);
}
