/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { StateSelect as StateSelectBlock } from "@plane/blocks/property-select";
import type { StateOption } from "@plane/blocks/property-select";
import type { SelectPaginationParams, SelectTooltip, SelectTooltipOverride, SelectVariant } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type { IState, TPaginatedResponse } from "@plane/types";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { useUser } from "@/hooks/store/user";
import { workflowAllowsCreation, workflowAllowsTransition, workflowIsActive } from "@/helpers/workflow";
import { getWorkflowErrorCode, getWorkflowErrorReason } from "@/helpers/workflow";
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
  const workflowStore = useProjectWorkflow(bypassWorkflow ? undefined : projectId);
  const { data: user } = useUser();
  const currentWorkflow = workflowStore.resolve(projectId ?? "", issueTypeId);
  const allowedStateIds = bypassWorkflow
    ? null
    : isForWorkItemCreation
      ? new Set(
          (getProjectStateIds(projectId) ?? []).filter((id) =>
            workflowAllowsCreation(currentWorkflow, id, getStateById(id))
          )
        )
      : !workflowIsActive(currentWorkflow)
        ? null
        : new Set(
            currentWorkflow!.states
              .filter((state) =>
                isForWorkItemCreation || !value || getStateById(value) === undefined
                  ? workflowAllowsCreation(currentWorkflow, state.id)
                  : workflowAllowsTransition(currentWorkflow, value, state.id, user?.id)
              )
              .map((state) => state.id)
          );
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
      if (!bypassWorkflow)
        await Promise.all([
          workflowStore.fetchList(workspaceSlug.toString(), projectId),
          workflowStore.fetchTypes(workspaceSlug.toString(), projectId),
        ]);
      const workflow = bypassWorkflow ? undefined : workflowStore.resolve(projectId, issueTypeId);
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
        .filter(
          (state) =>
            bypassWorkflow ||
            (isForWorkItemCreation || !value || getStateById(value) === undefined
              ? workflowAllowsCreation(workflow, state.id, state)
              : workflowAllowsTransition(workflow, value, state.id, user?.id))
        )
        .filter((state) => !query || state.name.toLowerCase().includes(query))
        .map((state) => toOption(state, getStatePercentageInGroup(state.id)));
      return { results, next_page_results: false };
    },
    [
      workspaceSlug,
      projectId,
      getProjectStateIds,
      fetchProjectStates,
      getStateById,
      getStatePercentageInGroup,
      bypassWorkflow,
      workflowStore,
      excludeStateIds,
      allowedStates,
      issueTypeId,
      isForWorkItemCreation,
      value,
      user?.id,
    ]
  );

  // Resolved in the observer render (not in a memo) so MobX re-renders when the state loads.
  const selectedState = value ? getStateById(value) : undefined;
  const selected = selectedState ? toOption(selectedState, getStatePercentageInGroup(selectedState.id)) : null;

  return (
    <StateSelectBlock
      getValues={getValues}
      allowedStateIds={allowedStateIds}
      value={selected}
      onChange={(stateId) => {
        void Promise.resolve()
          .then(() => onChange(stateId))
          .catch((error: unknown) => {
            const code = getWorkflowErrorCode(error);
            setToast({
              type: "error",
              title: t("error"),
              message:
                getWorkflowErrorReason(error) ??
                (code ? t(`web.workflow_errors.${code}`) : t("web.failed_to_perform_this_action")),
            });
          });
      }}
      variant={variant}
      disabled={disabled}
      placeholder={placeholder ?? t("state")}
      onClose={onClose}
      className={className}
      tooltip={resolvedTooltip}
      appendElement={appendElement}
      testId={testId}
      tabIndex={tabIndex}
    />
  );
});
