/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { setToast } from "@plane/blocks/toast";
import type {
  ISearchIssueResponse,
  TIssue,
  TIssueServiceType,
  TProjectIssueHierarchy,
  TWorkItemWidgets,
} from "@plane/types";
// components
import { ExistingIssuesListModal } from "@/components/core/modals/existing-issues-list-modal";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { IssueLinkCreateUpdateModal } from "../issue-detail/links/create-update-link-modal";
// helpers
import { CreateUpdateIssueModal } from "../issue-modal/modal";
import { useLinkOperations } from "./links/helper";
import { useSubIssueOperations } from "./sub-issues/helper";
import { hierarchyTypeSearchParam, legalChildTypeIds } from "@/helpers/issue-hierarchy";
import { useIssueHierarchy } from "@/hooks/use-issue-hierarchy";
import { translate } from "@plane/i18n";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueServiceType: TIssueServiceType;
  hideWidgets?: TWorkItemWidgets[];
};

export const IssueDetailWidgetModals = observer(function IssueDetailWidgetModals(props: Props) {
  const { workspaceSlug, projectId, issueId, issueServiceType, hideWidgets } = props;
  // store hooks
  const {
    issue: { getIssueById },
    isIssueLinkModalOpen,
    toggleIssueLinkModal: toggleIssueLinkModalStore,
    setIssueLinkData,
    isCreateIssueModalOpen,
    toggleCreateIssueModal,
    isSubIssuesModalOpen,
    toggleSubIssuesModal,
    relationKey,
    isRelationModalOpen,
    setRelationKey,
    setLastWidgetAction,
    toggleRelationModal,
    createRelation,
    issueCrudOperationState,
    setIssueCrudOperationState,
  } = useIssueDetail(issueServiceType);

  // helper hooks
  const subIssueOperations = useSubIssueOperations(issueServiceType);
  const handleLinkOperations = useLinkOperations(workspaceSlug, projectId, issueId, issueServiceType);

  // handlers
  const handleIssueCrudState = (
    key: "create" | "existing",
    _parentIssueId: string | null,
    issue: TIssue | null = null
  ) => {
    setIssueCrudOperationState({
      ...issueCrudOperationState,
      [key]: {
        toggle: !issueCrudOperationState[key].toggle,
        parentIssueId: _parentIssueId,
        issue: issue,
      },
    });
  };

  const handleExistingIssuesModalClose = () => {
    handleIssueCrudState("existing", null, null);
    setLastWidgetAction("sub-work-items");
    toggleSubIssuesModal(null);
  };

  const handleExistingIssuesModalOnSubmit = async (_issue: ISearchIssueResponse[]) =>
    subIssueOperations.addSubIssue(
      workspaceSlug,
      projectId,
      issueId,
      _issue.map((issue) => issue.id)
    );

  const handleCreateUpdateModalClose = () => {
    handleIssueCrudState("create", null, null);
    toggleCreateIssueModal(false);
    setLastWidgetAction("sub-work-items");
  };

  const handleCreateUpdateModalOnSubmit = async (_issue: TIssue) => {
    if (_issue.parent_id) {
      await subIssueOperations.fetchSubIssues(workspaceSlug, projectId, _issue.parent_id);
    }
  };

  const handleIssueLinkModalOnClose = () => {
    toggleIssueLinkModalStore(false);
    setLastWidgetAction("links");
    setIssueLinkData(null);
  };

  const handleRelationOnClose = () => {
    setRelationKey(null);
    toggleRelationModal(null, null);
    setLastWidgetAction("relations");
  };

  const handleExistingIssueModalOnSubmit = async (data: ISearchIssueResponse[]) => {
    if (!relationKey) return;
    if (data.length === 0) {
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: translate("web.please_select_at_least_one_work_item"),
      });
      return;
    }

    await createRelation(
      workspaceSlug,
      projectId,
      issueId,
      relationKey,
      data.map((i) => i.id)
    );

    toggleRelationModal(null, null);
  };

  // helpers
  const parent = getIssueById(issueCrudOperationState?.create?.parentIssueId ?? issueId);
  const existingParent = getIssueById(issueCrudOperationState?.existing?.parentIssueId ?? issueId);
  const { data: hierarchy } = useIssueHierarchy(projectId);
  const defaultChildType = getDefaultChildType(hierarchy, parent?.type_id);
  const createUpdateModalData: Partial<TIssue> = {
    ...(defaultChildType ? { type_id: defaultChildType } : {}),
    parent_id: issueCrudOperationState?.create?.parentIssueId,
    project_id: projectId,
  };

  const existingIssuesModalSearchParams = {
    sub_issue: true,
    type_id: hierarchyTypeSearchParam(existingParent?.type_id),
    issue_id: issueCrudOperationState?.existing?.parentIssueId,
  };

  // render conditions
  const shouldRenderExistingIssuesModal =
    !hideWidgets?.includes("sub-work-items") &&
    issueCrudOperationState?.existing?.toggle &&
    issueCrudOperationState?.existing?.parentIssueId &&
    isSubIssuesModalOpen;

  const shouldRenderCreateUpdateModal =
    !hideWidgets?.includes("sub-work-items") &&
    issueCrudOperationState?.create?.toggle &&
    issueCrudOperationState?.create?.parentIssueId &&
    isCreateIssueModalOpen;

  return (
    <>
      {!hideWidgets?.includes("links") && (
        <IssueLinkCreateUpdateModal
          isModalOpen={isIssueLinkModalOpen}
          handleOnClose={handleIssueLinkModalOnClose}
          linkOperations={handleLinkOperations}
          issueServiceType={issueServiceType}
        />
      )}

      {shouldRenderCreateUpdateModal && (
        <CreateUpdateIssueModal
          isOpen={issueCrudOperationState?.create?.toggle}
          data={createUpdateModalData}
          onClose={handleCreateUpdateModalClose}
          onSubmit={handleCreateUpdateModalOnSubmit}
          isProjectSelectionDisabled
        />
      )}

      {shouldRenderExistingIssuesModal && (
        <ExistingIssuesListModal
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          isOpen={issueCrudOperationState?.existing?.toggle}
          handleClose={handleExistingIssuesModalClose}
          searchParams={existingIssuesModalSearchParams}
          handleOnSubmit={handleExistingIssuesModalOnSubmit}
        />
      )}

      {!hideWidgets?.includes("relations") && (
        <ExistingIssuesListModal
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          isOpen={isRelationModalOpen?.issueId === issueId && isRelationModalOpen?.relationType === relationKey}
          handleClose={handleRelationOnClose}
          searchParams={{ issue_relation: true, issue_id: issueId }}
          handleOnSubmit={handleExistingIssueModalOnSubmit}
          workspaceLevelToggle
        />
      )}
    </>
  );
});

function getDefaultChildType(hierarchy: TProjectIssueHierarchy | undefined, parentTypeId: string | null | undefined) {
  if (!hierarchy?.enabled) return undefined;
  const childTypes = legalChildTypeIds(hierarchy.issue_types, parentTypeId);
  const allowed = new Set(childTypes);
  return hierarchy.issue_types.find((type) => type.is_default && allowed.has(type.id))?.id ?? childTypes[0];
}
