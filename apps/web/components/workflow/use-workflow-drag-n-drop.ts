/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "@plane/i18n";
import type { TIssueGroupByOptions } from "@plane/types";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser } from "@/hooks/store/user";
import { workflowAllowsCreation, workflowAllowsTransition } from "@/helpers/workflow";

export function useWorkFlowFDragNDrop(groupBy: TIssueGroupByOptions | undefined, subGroupBy?: TIssueGroupByOptions) {
  const { projectId } = useParams();
  const store = useProjectWorkflow(projectId);
  const { getStateById } = useProjectState();
  const { data: user } = useUser();
  const { t } = useTranslation();
  const [blocked, setBlocked] = useState(false);
  const getStateId = (groupId: string, subGroupId?: string) =>
    groupBy === "state" ? groupId : subGroupBy === "state" ? subGroupId : undefined;
  return {
    workflowDisabledSource: blocked ? t("web.workflow_ui.transition_blocked") : undefined,
    isWorkflowDropDisabled: blocked,
    getIsWorkflowWorkItemCreationDisabled: (groupId: string, subGroupId?: string, issueTypeId?: string | null) => {
      const stateId = getStateId(groupId, subGroupId);
      const state = stateId ? getStateById(stateId) : undefined;
      return !!state && !workflowAllowsCreation(store.resolve(state.project_id, issueTypeId), state.id, state);
    },
    handleWorkFlowState: (
      sourceGroupId: string,
      destinationGroupId: string,
      sourceSubGroupId?: string,
      destinationSubGroupId?: string,
      issueTypeId?: string | null
    ) => {
      const source = getStateId(sourceGroupId, sourceSubGroupId),
        destination = getStateId(destinationGroupId, destinationSubGroupId);
      const state = source ? getStateById(source) : undefined;
      setBlocked(
        !!source &&
          !!destination &&
          !!state &&
          !workflowAllowsTransition(store.resolve(state.project_id, issueTypeId), source, destination, user?.id)
      );
    },
  };
}
