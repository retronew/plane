/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { EIssuesStoreType } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
//hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useUserPermissions } from "@/hooks/store/user";
import { useGroupIssuesDragNDrop } from "@/hooks/use-group-dragndrop";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
// store
// ui
// types
import { DeleteIssueModal } from "../../delete-issue-modal";
import { IssueLayoutHOC } from "../issue-layout-HOC";
import type { IQuickActionProps, TRenderQuickActions } from "../list/list-view-types";
//components
import { KanBan } from "./default";
import { KanbanDeleteDropZone } from "./kanban-delete-drop-zone";
import { KanbanDndProvider } from "./kanban-dnd";
import { KanBanSwimLanes } from "./swimlanes";

export type KanbanStoreType =
  | EIssuesStoreType.GLOBAL
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.PROFILE
  | EIssuesStoreType.TEAM
  | EIssuesStoreType.TEAM_VIEW;

export interface IBaseKanBanLayout {
  QuickActions: FC<IQuickActionProps>;
  addIssuesToView?: (issueIds: string[]) => Promise<any>;
  canEditPropertiesBasedOnProject?: (projectId: string) => boolean;
  isCompletedCycle?: boolean;
  viewId?: string | undefined;
}

export const BaseKanBanRoot = observer(function BaseKanBanRoot(props: IBaseKanBanLayout) {
  const { QuickActions, addIssuesToView, canEditPropertiesBasedOnProject, isCompletedCycle = false, viewId } = props;
  // router
  // store hooks
  const storeType = useIssueStoreType() as KanbanStoreType;
  const { allowPermissions } = useUserPermissions();
  const { issueMap, issuesFilter, issues } = useIssues(storeType);
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const {
    fetchIssues,
    fetchNextIssues,
    quickAddIssue,
    updateIssue,
    removeIssue,
    removeIssueFromView,
    archiveIssue,
    restoreIssue,
  } = useIssuesActions(storeType);

  const displayFilters = issuesFilter?.issueFilters?.displayFilters;
  const displayProperties = issuesFilter?.issueFilters?.displayProperties;

  const sub_group_by = displayFilters?.sub_group_by;
  const group_by = displayFilters?.group_by;

  const orderBy = displayFilters?.order_by;

  useEffect(() => {
    if (issuesFilter.issueFilters?.displayFilters?.layout !== EIssueLayoutTypes.KANBAN) return;
    fetchIssues("init-loader", { canGroup: true, perPageCount: sub_group_by ? 10 : 30 }, viewId);
  }, [fetchIssues, issuesFilter, displayFilters?.layout, storeType, group_by, sub_group_by, viewId]);

  const fetchMoreIssues = useCallback(
    (groupId?: string, subgroupId?: string) => {
      if (issues?.getIssueLoader(groupId, subgroupId) !== "pagination") {
        fetchNextIssues(groupId, subgroupId);
      }
    },
    [fetchNextIssues, issues]
  );

  const groupedIssueIds = issues?.groupedIssueIds;

  const userDisplayFilters = displayFilters || null;

  const KanBanView = sub_group_by ? KanBanSwimLanes : KanBan;

  const { enableInlineEditing, enableQuickAdd, enableIssueCreation } = issues?.viewFlags || {};

  const scrollableContainerRef = useRef<HTMLDivElement | null>(null);

  // states
  const [draggedIssueId, setDraggedIssueId] = useState<string | undefined>(undefined);
  const [deleteIssueModal, setDeleteIssueModal] = useState(false);

  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  const handleOnDrop = useGroupIssuesDragNDrop(storeType, orderBy, group_by, sub_group_by);

  const handleRequestDelete = useCallback((workItemId: string) => {
    setDraggedIssueId(workItemId);
    setDeleteIssueModal(true);
  }, []);

  const canEditProperties = useCallback(
    (issueProjectId: string | undefined) => {
      const isEditingAllowedBasedOnProject =
        canEditPropertiesBasedOnProject && issueProjectId
          ? canEditPropertiesBasedOnProject(issueProjectId)
          : isEditingAllowed;

      return enableInlineEditing && isEditingAllowedBasedOnProject;
    },
    [canEditPropertiesBasedOnProject, enableInlineEditing, isEditingAllowed]
  );

  const renderQuickActions: TRenderQuickActions = useCallback(
    ({ issue, parentRef, customActionButton }) => (
      <QuickActions
        parentRef={parentRef}
        customActionButton={customActionButton}
        issue={issue}
        handleDelete={async () => removeIssue(issue.project_id, issue.id)}
        handleUpdate={async (data) => updateIssue && updateIssue(issue.project_id, issue.id, data)}
        handleRemoveFromView={async () => removeIssueFromView && removeIssueFromView(issue.project_id, issue.id)}
        handleArchive={async () => archiveIssue && archiveIssue(issue.project_id, issue.id)}
        handleRestore={async () => restoreIssue && restoreIssue(issue.project_id, issue.id)}
        readOnly={!canEditProperties(issue.project_id ?? undefined) || isCompletedCycle}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCompletedCycle, canEditProperties, removeIssue, updateIssue, removeIssueFromView, archiveIssue, restoreIssue]
  );

  const handleDeleteIssue = async () => {
    const draggedIssue = getIssueById(draggedIssueId ?? "");

    if (!draggedIssueId || !draggedIssue) return;

    try {
      await removeIssue(draggedIssue.project_id, draggedIssueId);
      setDeleteIssueModal(false);
      setDraggedIssueId(undefined);
    } catch (_error) {
      setDeleteIssueModal(false);
      setDraggedIssueId(undefined);
    }
  };

  return (
    <>
      <DeleteIssueModal
        dataId={draggedIssueId}
        isOpen={deleteIssueModal}
        handleClose={() => setDeleteIssueModal(false)}
        onSubmit={handleDeleteIssue}
      />
      {/* dnd-kit board: the delete zone is a target too, so it lives inside the provider */}
      <KanbanDndProvider orderBy={orderBy} handleOnDrop={handleOnDrop} onRequestDelete={handleRequestDelete}>
        <KanbanDeleteDropZone />
        <IssueLayoutHOC layout={EIssueLayoutTypes.KANBAN}>
          <div
            className={`horizontal-scrollbar relative scrollbar-md flex h-full w-full bg-surface-2 ${sub_group_by ? "vertical-scrollbar overflow-y-auto" : "overflow-x-auto overflow-y-hidden"}`}
            ref={scrollableContainerRef}
          >
            <div className="relative h-full w-max min-w-full bg-surface-2">
              <div className="h-full w-max">
                <KanBanView
                  issuesMap={issueMap}
                  groupedIssueIds={groupedIssueIds ?? {}}
                  getGroupIssueCount={issues.getGroupIssueCount}
                  displayProperties={displayProperties}
                  sub_group_by={sub_group_by}
                  group_by={group_by}
                  orderBy={orderBy}
                  updateIssue={updateIssue}
                  quickActions={renderQuickActions}
                  enableQuickIssueCreate={enableQuickAdd}
                  showEmptyGroup={userDisplayFilters?.show_empty_groups ?? true}
                  quickAddCallback={quickAddIssue}
                  disableIssueCreation={!enableIssueCreation || !isEditingAllowed || isCompletedCycle}
                  canEditProperties={canEditProperties}
                  addIssuesToView={addIssuesToView}
                  scrollableContainerRef={scrollableContainerRef}
                  loadMoreIssues={fetchMoreIssues}
                />
              </div>
            </div>
          </div>
        </IssueLayoutHOC>
      </KanbanDndProvider>
    </>
  );
});
