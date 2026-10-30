/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { observer } from "mobx-react";
// plane imports
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
import { Row } from "@plane/blocks/layout";
// hooks
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// plane web imports
import { useWorkFlowFDragNDrop } from "@/components/workflow";
// local imports
import type { TRenderQuickActions } from "../list/list-view-types";
import { getGroupByColumns, isWorkspaceLevel } from "../utils";
import { KanBan } from "./default";
import { HeaderGroupByCard } from "./headers/group-by-card";
import { HeaderSubGroupByCard } from "./headers/sub-group-by-card";

interface ISubGroupSwimlaneHeader {
  group_by: TIssueGroupByOptions | undefined;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  list: IGroupByColumn[];
  showEmptyGroup: boolean;
  sub_group_by: TIssueGroupByOptions | undefined;
}

const visibilitySubGroupByGroupCount = (subGroupIssueCount: number, showEmptyGroup: boolean): boolean => {
  let subGroupHeaderVisibility = true;

  if (showEmptyGroup) subGroupHeaderVisibility = true;
  else {
    if (subGroupIssueCount > 0) subGroupHeaderVisibility = true;
    else subGroupHeaderVisibility = false;
  }

  return subGroupHeaderVisibility;
};

const SubGroupSwimlaneHeader = observer(function SubGroupSwimlaneHeader({
  getGroupIssueCount,
  group_by,
  list,
  showEmptyGroup,
  sub_group_by,
}: ISubGroupSwimlaneHeader) {
  const { getIsWorkflowWorkItemCreationDisabled } = useWorkFlowFDragNDrop(group_by, sub_group_by);

  return (
    <div className="relative flex h-max min-h-full w-full items-center gap-4">
      {list &&
        list.length > 0 &&
        list.map((_list: IGroupByColumn) => {
          const groupCount = getGroupIssueCount(_list?.id, undefined, false) ?? 0;

          const subGroupByVisibilityToggle = visibilitySubGroupByGroupCount(groupCount, showEmptyGroup);

          if (subGroupByVisibilityToggle === false) return <></>;

          return (
            <div key={`${sub_group_by}_${_list.id}`} className="flex w-[350px] flex-shrink-0 flex-col">
              <HeaderGroupByCard
                sub_group_by={sub_group_by}
                group_by={group_by}
                column_id={_list.id}
                icon={_list.icon}
                title={_list.name}
                count={groupCount}
                issuePayload={_list.payload}
                disableIssueCreation={getIsWorkflowWorkItemCreationDisabled(_list.id)}
              />
            </div>
          );
        })}
    </div>
  );
});

interface ISubGroupSwimlane extends ISubGroupSwimlaneHeader {
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  canEditProperties: (projectId: string | undefined) => boolean;
  disableIssueCreation?: boolean;
  displayProperties: IIssueDisplayProperties | undefined;
  enableQuickIssueCreate: boolean;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  issuesMap: IIssueMap;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  orderBy: TIssueOrderByOptions | undefined;
  quickActions: TRenderQuickActions;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  showEmptyGroup: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
}

const SubGroupSwimlane = observer(function SubGroupSwimlane(props: ISubGroupSwimlane) {
  const {
    addIssuesToView,
    canEditProperties,
    disableIssueCreation,
    displayProperties,
    enableQuickIssueCreate,
    getGroupIssueCount,
    group_by,
    groupedIssueIds,
    issuesMap,
    list,
    loadMoreIssues,
    orderBy,
    quickActions,
    quickAddCallback,
    scrollableContainerRef,
    showEmptyGroup,
    sub_group_by,
    updateIssue,
  } = props;

  return (
    <div className="relative h-max min-h-full w-full">
      {list &&
        list.length > 0 &&
        list.map((_list: IGroupByColumn, subGroupIndex) => {
          const issueCount = getGroupIssueCount(undefined, _list.id, true) ?? 0;
          if (!showEmptyGroup && issueCount === 0) return null;
          return (
            <div key={_list.id} className="flex flex-shrink-0 flex-col">
              <div className="sticky top-[50px] z-[3] flex w-full items-center border-y-[0.5px] border-subtle bg-layer-1 py-1">
                <Row className="sticky left-0 flex-shrink-0">
                  <HeaderSubGroupByCard
                    column_id={_list.id}
                    icon={_list.icon}
                    title={_list.name}
                    count={issueCount}
                    sub_group_by={sub_group_by}
                  />
                </Row>
              </div>

              <div className="relative">
                <KanBan
                  issuesMap={issuesMap}
                  groupedIssueIds={groupedIssueIds}
                  getGroupIssueCount={getGroupIssueCount}
                  displayProperties={displayProperties}
                  sub_group_by={sub_group_by}
                  group_by={group_by}
                  sub_group_id={_list.id}
                  subGroupIndex={subGroupIndex}
                  updateIssue={updateIssue}
                  quickActions={quickActions}
                  showEmptyGroup={showEmptyGroup}
                  enableQuickIssueCreate={enableQuickIssueCreate}
                  disableIssueCreation={disableIssueCreation}
                  canEditProperties={canEditProperties}
                  addIssuesToView={addIssuesToView}
                  quickAddCallback={quickAddCallback}
                  scrollableContainerRef={scrollableContainerRef}
                  loadMoreIssues={loadMoreIssues}
                  orderBy={orderBy}
                  isDropDisabled={_list.isDropDisabled}
                  dropErrorMessage={_list.dropErrorMessage}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
});

export interface IKanBanSwimLanes {
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  canEditProperties: (projectId: string | undefined) => boolean;
  disableIssueCreation?: boolean;
  displayProperties: IIssueDisplayProperties | undefined;
  enableQuickIssueCreate: boolean;
  getGroupIssueCount: (
    groupId: string | undefined,
    subGroupId: string | undefined,
    isSubGroupCumulative: boolean
  ) => number | undefined;
  group_by: TIssueGroupByOptions | undefined;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  issuesMap: IIssueMap;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  orderBy: TIssueOrderByOptions | undefined;
  quickActions: TRenderQuickActions;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  showEmptyGroup: boolean;
  sub_group_by: TIssueGroupByOptions | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
}

export const KanBanSwimLanes = observer(function KanBanSwimLanes(props: IKanBanSwimLanes) {
  const {
    issuesMap,
    groupedIssueIds,
    getGroupIssueCount,
    displayProperties,
    sub_group_by,
    group_by,
    orderBy,
    updateIssue,
    quickActions,
    loadMoreIssues,
    showEmptyGroup,
    disableIssueCreation,
    enableQuickIssueCreate,
    canEditProperties,
    addIssuesToView,
    quickAddCallback,
    scrollableContainerRef,
  } = props;
  // store hooks
  const storeType = useIssueStoreType();
  // derived values
  const groupByList = getGroupByColumns({
    groupBy: group_by as GroupByColumnTypes,
    includeNone: true,
    isWorkspaceLevel: isWorkspaceLevel(storeType),
  });
  const subGroupByList = getGroupByColumns({
    groupBy: sub_group_by as GroupByColumnTypes,
    includeNone: true,
    isWorkspaceLevel: isWorkspaceLevel(storeType),
  });

  if (!groupByList || !subGroupByList) return null;

  return (
    <div className="relative">
      <Row className="sticky top-0 z-[4] h-[50px] bg-surface-2">
        <SubGroupSwimlaneHeader
          getGroupIssueCount={getGroupIssueCount}
          group_by={group_by}
          sub_group_by={sub_group_by}
          list={groupByList}
          showEmptyGroup={showEmptyGroup}
        />
      </Row>

      {sub_group_by && (
        <SubGroupSwimlane
          issuesMap={issuesMap}
          list={subGroupByList}
          groupedIssueIds={groupedIssueIds}
          getGroupIssueCount={getGroupIssueCount}
          displayProperties={displayProperties}
          group_by={group_by}
          sub_group_by={sub_group_by}
          orderBy={orderBy}
          updateIssue={updateIssue}
          quickActions={quickActions}
          loadMoreIssues={loadMoreIssues}
          showEmptyGroup={showEmptyGroup}
          disableIssueCreation={disableIssueCreation}
          enableQuickIssueCreate={enableQuickIssueCreate}
          addIssuesToView={addIssuesToView}
          canEditProperties={canEditProperties}
          quickAddCallback={quickAddCallback}
          scrollableContainerRef={scrollableContainerRef}
        />
      )}
    </div>
  );
});
