/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { observer } from "mobx-react";
import type {
  GroupByColumnTypes,
  IGroupByColumn,
  TGroupedIssues,
  TIssue,
  IIssueDisplayProperties,
  IIssueMap,
  TSubGroupedIssues,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
} from "@plane/types";
// constants
import { ContentWrapper } from "@plane/blocks/layout";
import { cn } from "@plane/utils";
// components
// hooks
import { useKanbanView } from "@/hooks/store/use-kanban-view";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// types
// parent components
import { useWorkFlowFDragNDrop } from "@/components/workflow";
import type { TRenderQuickActions } from "../list/list-view-types";
import { getGroupByColumns, isWorkspaceLevel } from "../utils";
// components
import { HeaderGroupByCard } from "./headers/group-by-card";
import { KanbanGroup } from "./kanban-group";

export interface IKanBan {
  issuesMap: IIssueMap;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  sub_group_by: TIssueGroupByOptions | undefined;
  group_by: TIssueGroupByOptions | undefined;
  orderBy: TIssueOrderByOptions | undefined;
  isDropDisabled?: boolean;
  dropErrorMessage?: string | undefined;
  sub_group_id?: string;
  sub_group_index?: number;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  enableQuickIssueCreate?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  disableIssueCreation?: boolean;
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  canEditProperties: (projectId: string | undefined) => boolean;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  showEmptyGroup?: boolean;
  subGroupIndex?: number;
}

export const KanBan = observer(function KanBan(props: IKanBan) {
  const {
    issuesMap,
    groupedIssueIds,
    getGroupIssueCount,
    displayProperties,
    sub_group_by,
    group_by,
    sub_group_id = "null",
    updateIssue,
    quickActions,
    enableQuickIssueCreate,
    quickAddCallback,
    loadMoreIssues,
    disableIssueCreation,
    addIssuesToView,
    canEditProperties,
    scrollableContainerRef,
    showEmptyGroup = true,
    orderBy,
    isDropDisabled,
    dropErrorMessage,
  } = props;
  // i18n
  // store hooks
  const storeType = useIssueStoreType();
  const issueKanBanView = useKanbanView();
  // derived values
  const isDragDisabled = !issueKanBanView?.getCanUserDragDrop(group_by, sub_group_by);

  const { getIsWorkflowWorkItemCreationDisabled } = useWorkFlowFDragNDrop(group_by, sub_group_by);

  const list = getGroupByColumns({
    groupBy: group_by as GroupByColumnTypes,
    includeNone: true,
    isWorkspaceLevel: isWorkspaceLevel(storeType),
  });

  if (!list) return null;

  const isGroupByCreatedBy = group_by === "created_by";

  return (
    <ContentWrapper className={`relative flex-row gap-4 !p-4`}>
      {list &&
        list.length > 0 &&
        list.map((subList: IGroupByColumn) => {
          if (!showEmptyGroup && (getGroupIssueCount(subList.id, undefined, false) ?? 0) <= 0) return null;

          return (
            <div
              key={subList.id}
              className={cn("group relative flex w-[336px] flex-shrink-0 flex-col", {
                // no inline padding here: it lives inside the scroll area, so the scrollbar sits at the column edge
                "h-full rounded-xl bg-layer-1 py-2": sub_group_by === null,
              })}
            >
              {sub_group_by === null && (
                <div className="sticky top-0 z-[2] w-full flex-shrink-0 bg-layer-1 px-3">
                  <HeaderGroupByCard
                    sub_group_by={sub_group_by}
                    group_by={group_by}
                    column_id={subList.id}
                    icon={subList.icon}
                    title={subList.name}
                    count={getGroupIssueCount(subList.id, undefined, false) ?? 0}
                    issuePayload={subList.payload}
                    disableIssueCreation={
                      disableIssueCreation ||
                      isGroupByCreatedBy ||
                      getIsWorkflowWorkItemCreationDisabled(subList.id, sub_group_id)
                    }
                    addIssuesToView={addIssuesToView}
                  />
                </div>
              )}

              <div className={sub_group_by ? "h-full min-h-[120px]" : "min-h-0 flex-1"}>
                <KanbanGroup
                  groupId={subList.id}
                  issuesMap={issuesMap}
                  groupedIssueIds={groupedIssueIds}
                  displayProperties={displayProperties}
                  sub_group_by={sub_group_by}
                  group_by={group_by}
                  orderBy={orderBy}
                  sub_group_id={sub_group_id}
                  isDragDisabled={isDragDisabled}
                  isDropDisabled={!!subList.isDropDisabled || !!isDropDisabled}
                  dropErrorMessage={subList.dropErrorMessage ?? dropErrorMessage}
                  updateIssue={updateIssue}
                  quickActions={quickActions}
                  enableQuickIssueCreate={enableQuickIssueCreate}
                  quickAddCallback={quickAddCallback}
                  disableIssueCreation={disableIssueCreation}
                  canEditProperties={canEditProperties}
                  scrollableContainerRef={scrollableContainerRef}
                  loadMoreIssues={loadMoreIssues}
                />
              </div>
            </div>
          );
        })}
    </ContentWrapper>
  );
});
