/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useSWRConfig } from "swr";
import { useParams } from "next/navigation";
// plane imports
import { StateSelect as StateSelectBlock } from "@plane/blocks/property-select";
import type { StateOption } from "@plane/blocks/property-select";
import type { SelectPaginationParams, SelectTooltip, SelectTooltipOverride, SelectVariant } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type { IState, TPaginatedResponse, TProjectWorkflow } from "@plane/types";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectWorkflowStore } from "@/hooks/store/use-project-workflow";
import { useUser } from "@/hooks/store/user";
import { workflowAllowsCreation, workflowAllowsTransition, workflowIsActive } from "@/helpers/workflow";
import { getWorkflowErrorCode, getWorkflowErrorReason, workflowRequiresApproval } from "@/helpers/workflow";
import { useApprovalTransitionConfirmation } from "@/components/workflow/use-approval-transition-confirmation";
import { setToast } from "@plane/blocks/toast";

type StateSelectWebProps = {
  /** Project whose states are offered. */
  projectId: string | undefined;
  /** Current state id (`null` / `undefined` when none). */
  value: string | null | undefined;
  /** Emits the next state id. */
  onChange: (stateId: string) => unknown;
  variant: SelectVariant;
  disabled?: boolean;
  placeholder?: string;
  onClose?: () => void;
  className?: string;
  tooltip?: SelectTooltip;
  appendElement?: ReactNode;
  /** Forwarded to the block's trigger — see `StateSelectProps["testId"]` doc comment. */
  testId?: string;
  /** Tab order of the trigger, for forms that sequence focus explicitly (`ETabIndices`). */
  tabIndex?: number;
  isForWorkItemCreation?: boolean;
  bypassWorkflow?: boolean;
  issueTypeId?: string | null;
  allowedStates?: string[];
  excludeStateIds?: string[];
};

const toOption = (state: IState, percentage?: number): StateOption => ({
  id: state.id,
  name: state.name,
  color: state.color,
  icon: state.icon,
  group: state.group,
  percentage,
});

/**
 * Web binding for the presentational `StateSelect` block. Resolves the project's states from the
 * project-state store (fetched on first open when the project has not been loaded yet), filters them
 * by the search query and maps the selected id to a `StateOption`.
 *
 * Creation and state changes share the project workflow policy. Configuration pickers explicitly
 * bypass gating so administrators can define new paths. The API enforces the same rules on save.
 */
export const StateSelect = observer(function StateSelect(props: StateSelectWebProps) {
  const {
    projectId,
    value,
    onChange,
    variant,
    disabled,
    placeholder,
    onClose,
    className,
    tooltip,
    appendElement,
    testId,
    tabIndex,
    isForWorkItemCreation = false,
    bypassWorkflow = false,
    excludeStateIds,
    issueTypeId,
    allowedStates,
  } = props;
  // router params
  const { workspaceSlug } = useParams();
  // store hooks
  const { getProjectStateIds, getStateById, fetchProjectStates, getStatePercentageInGroup } = useProjectState();
  const { getProjectById } = useProject();
  const workflowStore = useProjectWorkflowStore();
  const [open, setOpen] = useState(false);
  const { data: user } = useUser();
  const currentWorkflow =
    open && !bypassWorkflow && projectId ? workflowStore.resolve(projectId, issueTypeId) : undefined;
  const allowsState = useCallback(
    (workflow: TProjectWorkflow | undefined, state: IState) => {
      if (bypassWorkflow) return true;
      if (!workflow) return false;
      return isForWorkItemCreation || !value || getStateById(value) === undefined
        ? workflowAllowsCreation(workflow, state.id, state, getProjectById(projectId)?.disabled_state_groups)
        : workflowAllowsTransition(workflow, value, state.id, user?.id);
    },
    [bypassWorkflow, isForWorkItemCreation, value, getStateById, getProjectById, projectId, user?.id]
  );

  // Keep an open popup reactive if its workflow changes after the options have been fetched.
  const allowedStateIds =
    open && !bypassWorkflow && (!currentWorkflow || isForWorkItemCreation || workflowIsActive(currentWorkflow))
      ? new Set(
          (getProjectStateIds(projectId) ?? []).filter((id) => {
            const state = getStateById(id);
            return state && allowsState(currentWorkflow, state);
          })
        )
      : null;
  // translation
  const { t } = useTranslation();
  const resolvedTooltip = useMemo<SelectTooltipOverride | undefined>(() => {
    if (!tooltip) return undefined;
    const override = typeof tooltip === "object" ? tooltip : undefined;
    return {
      heading: override?.heading ?? t("common.state"),
      emptyContent: override?.emptyContent ?? t("common.none"),
    };
  }, [tooltip, t]);

  const getValues = useCallback(
    async ({ search }: SelectPaginationParams): Promise<TPaginatedResponse<StateOption[]>> => {
      if (!workspaceSlug || !projectId) return { results: [] };
      const workflow = bypassWorkflow
        ? undefined
        : await workflowStore.loadPolicy(workspaceSlug.toString(), projectId, issueTypeId);
      let stateIds = getProjectStateIds(projectId);
      if (!stateIds) {
        await fetchProjectStates(workspaceSlug.toString(), projectId);
        stateIds = getProjectStateIds(projectId);
      }
      const query = search?.trim().toLowerCase();
      const excluded = new Set(excludeStateIds);
      const allowed = allowedStates ? new Set(allowedStates) : undefined;
      const results = (stateIds ?? [])
        .map((stateId) => getStateById(stateId))
        .filter((state): state is IState => !!state)
        .filter((state) => !excluded.has(state.id) && (!allowed || allowed.has(state.id)))
        .filter((state) => allowsState(workflow, state))
        .filter((state) => !query || state.name.toLowerCase().includes(query))
        .map((state) => toOption(state, getStatePercentageInGroup(state.id)));
      return { results, next_page_results: false };
    },
    [
      workspaceSlug,
      projectId,
      getProjectStateIds,
      allowsState,
      fetchProjectStates,
      getStateById,
      getStatePercentageInGroup,
      bypassWorkflow,
      workflowStore,
      excludeStateIds,
      allowedStates,
      issueTypeId,
    ]
  );

  // Resolved in the observer render (not in a memo) so MobX re-renders when the state loads.
  const selectedState = value ? getStateById(value) : undefined;
  const selected = selectedState ? toOption(selectedState, getStatePercentageInGroup(selectedState.id)) : null;

  const { requestConfirmation, confirmationDialog } = useApprovalTransitionConfirmation();
  const { mutate } = useSWRConfig();
  const changeState = async (stateId: string) => {
    if (
      disabled ||
      !workspaceSlug ||
      !projectId ||
      excludeStateIds?.includes(stateId) ||
      (allowedStates && !allowedStates.includes(stateId))
    )
      return;
    try {
      const workflow = bypassWorkflow
        ? undefined
        : await workflowStore.loadPolicy(workspaceSlug.toString(), projectId, issueTypeId);
      const state = getStateById(stateId);
      if (!state || !allowsState(workflow, state)) return;
      const needsApproval =
        !bypassWorkflow && !isForWorkItemCreation && stateId !== value && workflowRequiresApproval(workflow, stateId);
      if (needsApproval && !(await requestConfirmation(getStateById(stateId)?.name ?? stateId))) return;
      await onChange(stateId);
      if (needsApproval)
        await mutate(
          (key) =>
            Array.isArray(key) && key[0] === "workflow-approvals" && key[1] === workspaceSlug && key[2] === projectId
        );
      if (needsApproval)
        setToast({
          type: "success",
          title: t("web.workflow_ui.entered_approval"),
          message: t("web.workflow_ui.entered_approval_description"),
        });
    } catch (error: unknown) {
      const code = getWorkflowErrorCode(error);
      setToast({
        type: "error",
        title: t("error"),
        message:
          getWorkflowErrorReason(error) ??
          (code ? t(`web.workflow_errors.${code}`) : t("web.failed_to_perform_this_action")),
      });
    }
  };

  return (
    <>
      <StateSelectBlock
        getValues={getValues}
        allowedStateIds={allowedStateIds}
        value={selected}
        onChange={(stateId) => {
          void changeState(stateId);
        }}
        variant={variant}
        disabled={disabled}
        placeholder={placeholder ?? t("state")}
        onOpenChange={setOpen}
        onClose={onClose}
        className={className}
        tooltip={resolvedTooltip}
        appendElement={appendElement}
        testId={testId}
        tabIndex={tabIndex}
      />
      {confirmationDialog}
    </>
  );
});
