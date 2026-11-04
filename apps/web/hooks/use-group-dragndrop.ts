/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { setToast } from "@plane/blocks/toast";
import type { SetToastProps } from "@plane/blocks/toast";
import type { EIssuesStoreType, TIssue, TIssueGroupByOptions, TIssueOrderByOptions } from "@plane/types";
import type { GroupDropLocation } from "@/components/issues/issue-layouts/utils";
import { handleGroupDragDrop } from "@/components/issues/issue-layouts/utils";
import { ISSUE_FILTER_DEFAULT_DATA } from "@/store/issue/helpers/base-issues.store";
import { useIssueDetail } from "./store/use-issue-detail";
import { useIssues } from "./store/use-issues";
import { useIssuesActions } from "./use-issues-actions";
import { translate } from "@plane/i18n";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { useUser } from "@/hooks/store/user";
import {
  workflowAllowsTransition,
  workflowRequiresApproval,
  getWorkflowErrorCode,
  getWorkflowErrorReason,
} from "@/helpers/workflow";
import { useApprovalTransitionConfirmation } from "@/components/workflow/use-approval-transition-confirmation";
import { useProjectState } from "@/hooks/store/use-project-state";

type DNDStoreType =
  | EIssuesStoreType.GLOBAL
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.PROFILE
  | EIssuesStoreType.ARCHIVED
  | EIssuesStoreType.WORKSPACE_DRAFT
  | EIssuesStoreType.TEAM
  | EIssuesStoreType.TEAM_VIEW
  | EIssuesStoreType.TEAM_PROJECT_WORK_ITEMS;

export const useGroupIssuesDragNDrop = (
  storeType: DNDStoreType,
  orderBy: TIssueOrderByOptions | undefined,
  groupBy: TIssueGroupByOptions | undefined,
  subGroupBy?: TIssueGroupByOptions
) => {
  const { workspaceSlug } = useParams();
  const workflowStore = useProjectWorkflow();
  const { data: currentUser } = useUser();
  const { getStateById } = useProjectState();
  const { requestConfirmation, confirmationDialog } = useApprovalTransitionConfirmation();
  const { mutate } = useSWRConfig();

  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { updateIssue } = useIssuesActions(storeType);
  const {
    issues: { getIssueIds, addCycleToIssue, removeCycleFromIssue, changeModulesInIssue },
  } = useIssues(storeType);

  /**
   * update Issue on Drop, checks if modules or cycles are changed and then calls appropriate functions
   * @param projectId
   * @param issueId
   * @param data
   * @param issueUpdates
   */
  const updateIssueOnDrop = async (
    projectId: string,
    issueId: string,
    data: Partial<TIssue>,
    issueUpdates: {
      [groupKey: string]: {
        ADD: string[];
        REMOVE: string[];
      };
    },
    beforeConfirmation?: () => void
  ) => {
    const previous = getIssueById(issueId);
    let needsApproval = false;
    if (workspaceSlug && data.state_id && previous?.state_id) {
      await Promise.all([
        workflowStore.fetchList(workspaceSlug.toString(), projectId),
        workflowStore.fetchTypes(workspaceSlug.toString(), projectId),
      ]);
      const workflow = workflowStore.resolve(projectId, previous.type_id);
      if (!workflowAllowsTransition(workflow, previous.state_id, data.state_id, currentUser?.id)) {
        setToast({
          type: "warning",
          title: translate("common.warning"),
          message: translate("web.workflow_ui.transition_blocked"),
        });
        return;
      }
      needsApproval = data.state_id !== previous.state_id && workflowRequiresApproval(workflow, data.state_id);
      if (needsApproval) {
        // Clear the visual drag preview before opening the confirmation dialog.
        beforeConfirmation?.();
        if (!(await requestConfirmation(getStateById(data.state_id)?.name ?? data.state_id))) return;
      }
      // Do not apply a queued drag after the work item has changed while the dialog was open.
      if (getIssueById(issueId)?.state_id !== previous.state_id) return;
    }
    const errorToastProps: SetToastProps = {
      type: "error",
      title: translate("toast.error"),
      message: translate("web.error_while_updating_work_item"),
    };
    const moduleKey = ISSUE_FILTER_DEFAULT_DATA["module"];
    const cycleKey = ISSUE_FILTER_DEFAULT_DATA["cycle"];

    const isModuleChanged = Object.keys(data).includes(moduleKey);
    const isCycleChanged = Object.keys(data).includes(cycleKey);

    // Let the API confirm the state change before mutating other grouping dimensions.
    // The server may have newer rules than the cached policy used for the drag preview.
    const issueData = { ...data };
    if (isCycleChanged) delete issueData[cycleKey];
    if (isModuleChanged) delete issueData[moduleKey];
    if (updateIssue && Object.keys(issueData).length > 0) {
      try {
        await updateIssue(projectId, issueId, issueData);
        if (needsApproval)
          await mutate(
            (key) =>
              Array.isArray(key) &&
              key[0] === "workflow-approvals" &&
              key[1] === workspaceSlug &&
              key[2] === projectId &&
              key[3] === issueId
          );
        if (needsApproval)
          setToast({
            type: "success",
            title: translate("web.workflow_ui.entered_approval"),
            message: translate("web.workflow_ui.entered_approval_description"),
          });
      } catch (error: unknown) {
        const code = getWorkflowErrorCode(error);
        setToast({
          ...errorToastProps,
          message:
            getWorkflowErrorReason(error) ??
            (code ? translate(`web.workflow_errors.${code}`) : errorToastProps.message),
        });
        return;
      }
    }

    if (isCycleChanged && workspaceSlug) {
      if (data[cycleKey]) {
        addCycleToIssue(workspaceSlug.toString(), projectId, data[cycleKey]?.toString() ?? "", issueId).catch(() =>
          setToast(errorToastProps)
        );
      } else {
        removeCycleFromIssue(workspaceSlug.toString(), projectId, issueId).catch(() => setToast(errorToastProps));
      }
    }

    if (isModuleChanged && workspaceSlug && issueUpdates[moduleKey]) {
      changeModulesInIssue(
        workspaceSlug.toString(),
        projectId,
        issueId,
        issueUpdates[moduleKey].ADD,
        issueUpdates[moduleKey].REMOVE
      ).catch(() => setToast(errorToastProps));
    }
  };

  const handleOnDrop = async (
    source: GroupDropLocation,
    destination: GroupDropLocation,
    beforeConfirmation?: () => void
  ) => {
    if (
      source.columnId &&
      destination.columnId &&
      destination.columnId === source.columnId &&
      destination.id === source.id
    )
      return;

    await handleGroupDragDrop(
      source,
      destination,
      getIssueById,
      getIssueIds,
      (projectId, issueId, data, issueUpdates) =>
        updateIssueOnDrop(projectId, issueId, data, issueUpdates, beforeConfirmation),
      groupBy,
      subGroupBy,
      orderBy !== "sort_order"
    ).catch((err) => {
      setToast({
        title: translate("toast.error"),
        type: "error",
        message: err?.detail ?? translate("web.failed_to_perform_this_action"),
      });
    });
  };

  return { handleOnDrop, confirmationDialog };
};
