import type { TProjectWorkflow } from "@plane/types";

export function workflowDisplayName(workflow: TProjectWorkflow | undefined, defaultName: string): string {
  const isDefault = workflow?.is_default || workflow?.id === "default";
  if (!workflow?.name || (isDefault && workflow.name === "Default workflow")) return defaultName;
  return workflow.name;
}
