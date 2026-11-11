/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import {
  EIssueFilterType,
  ISSUE_DISPLAY_FILTERS_BY_PAGE,
  SUB_WORK_ITEM_AVAILABLE_FILTERS_FOR_WORK_ITEM_PAGE,
} from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilterOptions,
  TIssueServiceType,
} from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { SubIssueDisplayFilters } from "./display-filters";
import { SubIssueFilters } from "./filters";
import { SubIssuesActionButton } from "./quick-action-button";

type TSubWorkItemTitleActionsProps = {
  disabled: boolean;
  issueServiceType?: TIssueServiceType;
  parentId: string;
  projectId: string;
};

export const SubWorkItemTitleActions = observer(function SubWorkItemTitleActions(props: TSubWorkItemTitleActionsProps) {
  const { disabled, issueServiceType = EIssueServiceType.ISSUES, parentId, projectId } = props;

  // store hooks
  const {
    subIssues: {
      filters: { getSubIssueFilters, updateSubWorkItemFilters },
    },
  } = useIssueDetail(issueServiceType);
  const { getProjectStates } = useProjectState();
  const workflowStore = useProjectWorkflow(projectId);
  const {
    project: { getProjectMemberIds },
  } = useMember();

  // derived values
  const projectStates = getProjectStates(projectId);
  const projectMemberIds = getProjectMemberIds(projectId, false);
  const subIssueFilters = getSubIssueFilters(parentId);
  const layoutDisplayFiltersOptions = ISSUE_DISPLAY_FILTERS_BY_PAGE["sub_work_items"].layoutOptions.list;

  const handleDisplayFilters = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      updateSubWorkItemFilters(EIssueFilterType.DISPLAY_FILTERS, updatedDisplayFilter, parentId);
    },
    [updateSubWorkItemFilters, parentId]
  );

  const handleDisplayPropertiesUpdate = useCallback(
    (updatedDisplayProperties: Partial<IIssueDisplayProperties>) => {
      updateSubWorkItemFilters(EIssueFilterType.DISPLAY_PROPERTIES, updatedDisplayProperties, parentId);
    },
    [updateSubWorkItemFilters, parentId]
  );

  const handleFiltersUpdate = useCallback(
    (filters: IIssueFilterOptions) => {
      updateSubWorkItemFilters(EIssueFilterType.FILTERS, filters, parentId);
    },
    [updateSubWorkItemFilters, parentId]
  );

  return (
    <div className="flex shrink-0 items-center gap-1">
      <SubIssueDisplayFilters
        layoutDisplayFiltersOptions={layoutDisplayFiltersOptions}
        displayProperties={subIssueFilters?.displayProperties ?? {}}
        displayFilters={subIssueFilters?.displayFilters ?? {}}
        handleDisplayPropertiesUpdate={handleDisplayPropertiesUpdate}
        handleDisplayFiltersUpdate={handleDisplayFilters}
      />
      <SubIssueFilters
        handleFiltersUpdate={handleFiltersUpdate}
        filters={subIssueFilters?.filters ?? {}}
        memberIds={projectMemberIds ?? undefined}
        states={projectStates}
        issueTypes={workflowStore.issueTypes[projectId]?.results}
        availableFilters={SUB_WORK_ITEM_AVAILABLE_FILTERS_FOR_WORK_ITEM_PAGE}
      />
      {!disabled && (
        <SubIssuesActionButton issueId={parentId} disabled={disabled} issueServiceType={issueServiceType} />
      )}
    </div>
  );
});
