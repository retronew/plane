import type { IState, TIssue, TProjectWorkflow } from "@plane/types";
import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";
import { workflowAllowsCreation, workflowIsActive } from "@/helpers/workflow";

export function isTemplateAvailable(template: WorkspaceTemplate, kind: WorkspaceTemplate["kind"], projectId?: string) {
  return template.kind === kind && (!template.project || template.project === projectId);
}

export function getPageTemplatePatch(template: WorkspaceTemplate) {
  return {
    name: template.title,
    description_html: template.description_html,
    ...(template.configuration?.logo_props !== undefined ? { logo_props: template.configuration.logo_props } : {}),
  };
}

export function getWorkItemTemplatePatch(
  template: WorkspaceTemplate,
  current: Pick<TIssue, "type_id" | "state_id">,
  workflow?: TProjectWorkflow,
  getState?: (id: string) => IState | undefined
) {
  const configuration = template.configuration;
  const stateId = configuration?.state_id ?? current.state_id;
  return {
    name: template.title,
    description_html: template.description_html,
    priority: template.priority,
    // Older workspace templates omit the type; keep the form's existing/default type in that case.
    ...(configuration?.type_id !== undefined ? { type_id: configuration.type_id } : {}),
    state_id:
      (!stateId && workflowIsActive(workflow)) ||
      (stateId && !workflowAllowsCreation(workflow, stateId, getState?.(stateId)))
        ? (workflow?.effective_initial_state_id ?? null)
        : stateId,
    assignee_ids: configuration?.assignee_ids ?? [],
    label_ids: configuration?.label_ids ?? [],
    module_ids: configuration?.module_ids ?? [],
    template_children: configuration?.children ?? [],
  };
}
