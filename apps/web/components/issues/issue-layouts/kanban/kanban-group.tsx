/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/utils/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { observer } from "mobx-react";
// plane constants
import { DRAG_ALLOWED_GROUPS } from "@plane/constants";
// i18n
import { useTranslation } from "@plane/i18n";
//types
import { setToast } from "@plane/blocks/toast";
import type {
  TGroupedIssues,
  TIssue,
  IIssueDisplayProperties,
  IIssueMap,
  TSubGroupedIssues,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
} from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { cn } from "@plane/utils";
import type { GroupDropLocation } from "@/components/issues/issue-layouts/utils";
// components
import {
  highlightIssueOnDrop,
  getSourceFromDropPayload,
  getDestinationFromDropPayload,
  getIssueBlockId,
} from "@/components/issues/issue-layouts/utils";
import { KanbanIssueBlockLoader } from "@/components/ui/loader/layouts/kanban-layout-loader";
import { useWorkFlowFDragNDrop } from "@/components/workflow";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
// local imports
import { GroupDragOverlay } from "../group-drag-overlay";
import type { TRenderQuickActions } from "../list/list-view-types";
import { KanbanQuickAddIssueButton, QuickAddIssueRoot } from "../quick-add";
import { KanbanIssueBlocksList } from "./blocks-list";

interface IKanbanGroup {
  groupId: string;
  issuesMap: IIssueMap;
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues;
  displayProperties: IIssueDisplayProperties | undefined;
  sub_group_by: TIssueGroupByOptions | undefined;
  group_by: TIssueGroupByOptions | undefined;
  sub_group_id: string;
  isDragDisabled: boolean;
  isDropDisabled: boolean;
  dropErrorMessage: string | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  enableQuickIssueCreate?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  loadMoreIssues: (groupId?: string, subGroupId?: string) => void;
  disableIssueCreation?: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  groupByVisibilityToggle?: boolean;
  scrollableContainerRef?: MutableRefObject<HTMLDivElement | null>;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  orderBy: TIssueOrderByOptions | undefined;
}

// quick-add preload mapping: group-by key -> issue field
const GROUP_KEY_TO_PRELOAD_FIELD: Record<string, string> = {
  state: "state_id",
  priority: "priority",
  cycle: "cycle_id",
  module: "module_ids",
  labels: "label_ids",
  assignees: "assignee_ids",
};

const NONE_VALUE_GROUP_KEYS = new Set(["labels", "assignees"]);
const ARRAY_VALUE_GROUP_KEYS = new Set(["module", "labels", "assignees"]);

const getGroupPreloadEntry = (groupKey: TIssueGroupByOptions | undefined, groupValue: string) => {
  if (!groupKey || groupKey === "created_by") return {};

  // "None" labels/assignees keep the raw group-by key (and value) instead of an id array
  if (NONE_VALUE_GROUP_KEYS.has(groupKey) && groupValue === "None") return { [groupKey]: groupValue };

  const field = GROUP_KEY_TO_PRELOAD_FIELD[groupKey] ?? groupKey;
  return { [field]: ARRAY_VALUE_GROUP_KEYS.has(groupKey) ? [groupValue] : groupValue };
};

const getPrePopulatedData = (
  defaultStateId: string | undefined,
  groupByKey: TIssueGroupByOptions | undefined,
  subGroupByKey: TIssueGroupByOptions | undefined,
  groupValue: string,
  subGroupValue: string
): object => ({
  state_id: defaultStateId,
  ...getGroupPreloadEntry(groupByKey, groupValue),
  ...getGroupPreloadEntry(subGroupByKey, subGroupValue),
});

const isSubGroupId = (subGroupId: string) => !!subGroupId && subGroupId !== "null";

const getGroupIssueIds = (
  groupedIssueIds: TGroupedIssues | TSubGroupedIssues,
  groupId: string,
  subGroupId: string
): string[] => {
  if (isSubGroupId(subGroupId)) return (groupedIssueIds as TSubGroupedIssues)?.[groupId]?.[subGroupId] ?? [];
  return (groupedIssueIds as TGroupedIssues)?.[groupId] ?? [];
};

const getShouldLoadMore = (issueIds: string[], nextPageResults: boolean | undefined, groupIssueCount: number) =>
  nextPageResults === undefined ? issueIds.length < groupIssueCount : !!nextPageResults;

const getCanOverlayBeVisible = (
  isWorkflowDropDisabled: boolean,
  orderBy: TIssueOrderByOptions | undefined,
  isDropDisabled: boolean
) => isWorkflowDropDisabled || orderBy !== "sort_order" || isDropDisabled;

const getCanDragIssuesInCurrentGrouping = (
  groupBy: TIssueGroupByOptions | undefined,
  subGroupBy: TIssueGroupByOptions | undefined
) =>
  !!groupBy && DRAG_ALLOWED_GROUPS.includes(groupBy) && (subGroupBy ? DRAG_ALLOWED_GROUPS.includes(subGroupBy) : true);

function KanbanGroupLoadMore(props: {
  isPaginating: boolean;
  isSubGroup: boolean;
  onLoadMore: () => void;
  setIntersectionElement: (element: HTMLSpanElement | null) => void;
}) {
  const { t } = useTranslation();
  const { isPaginating, isSubGroup, onLoadMore, setIntersectionElement } = props;

  if (isSubGroup) {
    if (isPaginating) return <KanbanIssueBlockLoader />;

    return (
      <button
        type="button"
        className="sticky bottom-0 w-full cursor-pointer p-3 text-left text-13 font-medium text-accent-primary hover:text-accent-secondary hover:underline"
        onClick={onLoadMore}
      >
        {t("common.load_more")} &darr;
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 2 }).map((_, index) => (
        // oxlint-disable-next-line react/no-array-index-key
        <KanbanIssueBlockLoader key={index} />
      ))}
      <KanbanIssueBlockLoader ref={setIntersectionElement} />
    </div>
  );
}

const QuickAddSection = observer(function QuickAddSection(props: {
  groupId: string;
  sub_group_id: string;
  group_by: TIssueGroupByOptions | undefined;
  sub_group_by: TIssueGroupByOptions | undefined;
  enableQuickIssueCreate?: boolean;
  disableIssueCreation?: boolean;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
  getIsWorkflowWorkItemCreationDisabled: (groupId: string, subGroupId?: string, issueTypeId?: string | null) => boolean;
}) {
  const projectState = useProjectState();

  if (!props.enableQuickIssueCreate || props.disableIssueCreation) return null;
  if (props.getIsWorkflowWorkItemCreationDisabled(props.groupId, props.sub_group_id)) return null;

  const defaultState = projectState.projectStates?.find((state) => state.default);

  return (
    <div className={cn("sticky bottom-0 w-full pt-1", props.sub_group_by ? "bg-surface-2" : "bg-layer-1")}>
      <QuickAddIssueRoot
        layout={EIssueLayoutTypes.KANBAN}
        QuickAddButton={KanbanQuickAddIssueButton}
        prePopulatedData={{
          ...(props.group_by &&
            getPrePopulatedData(
              defaultState?.id,
              props.group_by,
              props.sub_group_by,
              props.groupId,
              props.sub_group_id
            )),
        }}
        quickAddCallback={props.quickAddCallback}
      />
    </div>
  );
});

export const KanbanGroup = observer(function KanbanGroup(props: IKanbanGroup) {
  const {
    groupId,
    sub_group_id,
    group_by,
    orderBy,
    sub_group_by,
    issuesMap,
    displayProperties,
    groupedIssueIds,
    isDropDisabled,
    dropErrorMessage,
    updateIssue,
    quickActions,
    canEditProperties,
    loadMoreIssues,
    enableQuickIssueCreate,
    disableIssueCreation,
    quickAddCallback,
    scrollableContainerRef,
    handleOnDrop,
  } = props;
  // i18n
  const { t } = useTranslation();

  const {
    issues: { getGroupIssueCount, getPaginationData, getIssueLoader },
  } = useIssuesStore();

  const [intersectionElement, setIntersectionElement] = useState<HTMLSpanElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);

  const containerRef = sub_group_by && scrollableContainerRef ? scrollableContainerRef : columnRef;

  const loadMoreIssuesInThisGroup = useCallback(() => {
    loadMoreIssues(groupId, sub_group_id === "null" ? undefined : sub_group_id);
  }, [loadMoreIssues, groupId, sub_group_id]);

  const isPaginating = !!getIssueLoader(groupId, sub_group_id);

  useIntersectionObserver(
    containerRef,
    isPaginating ? null : intersectionElement,
    loadMoreIssuesInThisGroup,
    `0% 100% 100% 100%`
  );
  const [isDraggingOverColumn, setIsDraggingOverColumn] = useState(false);

  const { workflowDisabledSource, isWorkflowDropDisabled, handleWorkFlowState, getIsWorkflowWorkItemCreationDisabled } =
    useWorkFlowFDragNDrop(group_by, sub_group_by);

  const onDragEnter = useEffectEvent(
    (payload: Parameters<NonNullable<Parameters<typeof dropTargetForElements>[0]["onDragEnter"]>>[0]) => {
      const source = getSourceFromDropPayload(payload);
      setIsDraggingOverColumn(true);
      // handle if dragging a workflowState
      if (source) {
        handleWorkFlowState(
          source?.groupId,
          groupId,
          source?.subGroupId,
          sub_group_id,
          issuesMap[source.id ?? ""]?.type_id
        );
      }
    }
  );
  const onDragStart = useEffectEvent(
    (payload: Parameters<NonNullable<Parameters<typeof dropTargetForElements>[0]["onDragStart"]>>[0]) => {
      const source = getSourceFromDropPayload(payload);
      setIsDraggingOverColumn(true);
      // handle if dragging a workflowState
      if (source) {
        handleWorkFlowState(
          source?.groupId,
          groupId,
          source?.subGroupId,
          sub_group_id,
          issuesMap[source.id ?? ""]?.type_id
        );
      }
    }
  );
  const onDrop = useEffectEvent(
    (payload: Parameters<NonNullable<Parameters<typeof dropTargetForElements>[0]["onDrop"]>>[0]) => {
      setIsDraggingOverColumn(false);
      const source = getSourceFromDropPayload(payload);
      const destination = getDestinationFromDropPayload(payload);

      if (!source || !destination) return;

      if (isWorkflowDropDisabled || isDropDisabled) {
        if (dropErrorMessage)
          setToast({
            type: "warning",
            title: t("common.warning"),
            message: dropErrorMessage,
          });
        return;
      }

      handleOnDrop(source, destination);

      highlightIssueOnDrop(
        getIssueBlockId(source.id, destination?.groupId, destination?.subGroupId),
        orderBy !== "sort_order"
      );
    }
  );
  // Enable Kanban Columns as Drop Targets
  useEffect(() => {
    const element = columnRef.current;

    if (!element) return;

    return combine(
      dropTargetForElements({
        element,
        getData: () => ({ groupId, subGroupId: sub_group_id, columnId: `${groupId}__${sub_group_id}`, type: "COLUMN" }),
        onDragEnter: (payload) => onDragEnter(payload),
        onDragLeave: () => {
          setIsDraggingOverColumn(false);
        },
        onDragStart: (payload) => onDragStart(payload),
        onDrop: (payload) => onDrop(payload),
      }),
      autoScrollForElements({
        element,
      })
    );
  }, [groupId, sub_group_id]);

  const isSubGroup = isSubGroupId(sub_group_id);

  const issueIds = getGroupIssueIds(groupedIssueIds, groupId, sub_group_id);

  const groupIssueCount = getGroupIssueCount(groupId, sub_group_id, false) ?? 0;

  const nextPageResults = getPaginationData(groupId, sub_group_id)?.nextPageResults;

  const shouldLoadMore = getShouldLoadMore(issueIds, nextPageResults, groupIssueCount);

  const canOverlayBeVisible = getCanOverlayBeVisible(isWorkflowDropDisabled, orderBy, isDropDisabled);
  const shouldOverlayBeVisible = isDraggingOverColumn && canOverlayBeVisible;
  const canDragIssuesInCurrentGrouping = getCanDragIssuesInCurrentGrouping(group_by, sub_group_by);

  return (
    <div
      id={`${groupId}__${sub_group_id}`}
      className={cn(
        "relative h-full min-h-[120px] transition-all",
        { "rounded-xl bg-layer-1": isDraggingOverColumn },
        { "vertical-scrollbar scrollbar-sm pt-2": !sub_group_by && !shouldOverlayBeVisible }
      )}
      ref={columnRef}
    >
      <GroupDragOverlay
        dragColumnOrientation={sub_group_by ? "justify-start" : "justify-center"}
        canOverlayBeVisible={canOverlayBeVisible}
        isDropDisabled={isWorkflowDropDisabled || isDropDisabled}
        workflowDisabledSource={workflowDisabledSource}
        dropErrorMessage={dropErrorMessage}
        orderBy={orderBy}
        isDraggingOverColumn={isDraggingOverColumn}
      />
      <KanbanIssueBlocksList
        sub_group_id={sub_group_id}
        groupId={groupId}
        issuesMap={issuesMap}
        issueIds={issueIds}
        displayProperties={displayProperties}
        updateIssue={updateIssue}
        quickActions={quickActions}
        canEditProperties={canEditProperties}
        scrollableContainerRef={scrollableContainerRef}
        canDropOverIssue={!canOverlayBeVisible}
        canDragIssuesInCurrentGrouping={canDragIssuesInCurrentGrouping}
      />

      {shouldLoadMore && (
        <KanbanGroupLoadMore
          isPaginating={isPaginating}
          isSubGroup={isSubGroup}
          onLoadMore={loadMoreIssuesInThisGroup}
          setIntersectionElement={setIntersectionElement}
        />
      )}

      <QuickAddSection
        groupId={groupId}
        sub_group_id={sub_group_id}
        group_by={group_by}
        sub_group_by={sub_group_by}
        enableQuickIssueCreate={enableQuickIssueCreate}
        disableIssueCreation={disableIssueCreation}
        quickAddCallback={quickAddCallback}
        getIsWorkflowWorkItemCreationDisabled={getIsWorkflowWorkItemCreationDisabled}
      />
    </div>
  );
});
