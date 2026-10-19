/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { CollapsiblePanel } from "@makeplane/propel/components/collapsible";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { observer } from "mobx-react";
// plane imports
import { DRAG_ALLOWED_GROUPS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type {
  IGroupByColumn,
  TIssueMap,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
  TIssue,
  IIssueDisplayProperties,
  TIssueKanbanFilters,
} from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { Row } from "@plane/blocks/layout";
import { cn } from "@plane/utils";
// components
import { ListLoaderItemRow } from "@/components/ui/loader/layouts/list-layout-loader";
import { useCollapsibleVisibilityUpdates } from "@/components/core/visibility-observer-boundary";
import { useWorkFlowFDragNDrop } from "@/components/workflow";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// local imports
import { GroupDragOverlay } from "../group-drag-overlay";
import { ListQuickAddIssueButton, QuickAddIssueRoot } from "../quick-add";
import type { GroupDropLocation } from "../utils";
import {
  getDestinationFromDropPayload,
  getIssueBlockId,
  getSourceFromDropPayload,
  highlightIssueOnDrop,
} from "../utils";
import { IssueBlocksList } from "./blocks-list";
import { HeaderGroupByCard } from "./headers/group-by-card";
import type { TRenderQuickActions } from "./list-view-types";

interface Props {
  groupIssueIds: string[] | undefined;
  group: IGroupByColumn;
  issuesMap: TIssueMap;
  group_by: TIssueGroupByOptions | null;
  orderBy: TIssueOrderByOptions | undefined;
  getGroupIndex: (groupId: string | undefined) => number;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  displayProperties: IIssueDisplayProperties | undefined;
  enableIssueQuickAdd: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  quickAddCallback?: ((projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>) | undefined;
  handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
  disableIssueCreation?: boolean;
  addIssuesToView?: (issueIds: string[]) => Promise<TIssue>;
  isCompletedCycle?: boolean;
  showEmptyGroup?: boolean;
  loadMoreIssues: (groupId?: string) => void;
  selectionHelpers: TSelectionHelper;
  handleCollapsedGroups: (value: string) => void;
  collapsedGroups: TIssueKanbanFilters;
}

// A shared empty list keeps the default stable for the shallow prop comparison in `observer`.
const EMPTY_ISSUE_IDS: string[] = [];

type TDropPayload = Parameters<NonNullable<Parameters<typeof dropTargetForElements>[0]["onDrop"]>>[0];
type TDragPayload = Parameters<NonNullable<Parameters<typeof dropTargetForElements>[0]["onDrag"]>>[0];
type TDragColumnOrientation = "justify-start" | "justify-end";
type TWorkflowStateHandler = ReturnType<typeof useWorkFlowFDragNDrop>["handleWorkFlowState"];
type TTranslator = ReturnType<typeof useTranslation>["t"];
type TProjectState = ReturnType<typeof useProjectState>;

const getIsGroupExpanded = (collapsedGroups: TIssueKanbanFilters, groupId: string) =>
  !collapsedGroups?.group_by.includes(groupId);

const getShouldLoadMore = (
  nextPageResults: boolean | undefined,
  groupIssueCount: number | undefined,
  groupIssueIds: string[] | undefined
) => {
  if (nextPageResults !== undefined) return nextPageResults;
  if (groupIssueCount === undefined || !groupIssueIds) return false;
  return groupIssueIds.length < groupIssueCount;
};

const getPrePopulatedQuickAddData = (
  groupByKey: TIssueGroupByOptions | null,
  value: string,
  defaultStateId: string | undefined
): object => {
  const preloadedData = { state_id: defaultStateId };

  if (groupByKey === null) return { ...preloadedData };

  switch (groupByKey) {
    case "state":
      return { ...preloadedData, state_id: value };
    case "priority":
      return { ...preloadedData, priority: value };
    case "labels":
      return value !== "None" ? { ...preloadedData, label_ids: [value] } : { ...preloadedData, labels: value };
    case "assignees":
      return value !== "None" ? { ...preloadedData, assignee_ids: [value] } : { ...preloadedData, assignees: value };
    case "cycle":
      return value !== "None" ? { ...preloadedData, cycle_id: value } : { ...preloadedData, cycle: value };
    case "module":
      return value !== "None" ? { ...preloadedData, module_ids: [value] } : { ...preloadedData, module: value };
    case "created_by":
      return { ...preloadedData };
    default:
      return { ...preloadedData, [groupByKey]: value };
  }
};

const getIsGroupVisible = (showEmptyGroup: boolean | undefined, issueCount: number) =>
  Boolean(showEmptyGroup) || issueCount > 0;

const getIsDragAllowed = (groupBy: TIssueGroupByOptions | null) =>
  groupBy ? DRAG_ALLOWED_GROUPS.includes(groupBy) : true;

const getCanOverlayBeVisible = (
  isWorkflowDropDisabled: boolean,
  orderBy: TIssueOrderByOptions | undefined,
  isDropDisabled: boolean | undefined
) => isWorkflowDropDisabled || orderBy !== "sort_order" || !!isDropDisabled;

const getIsDropDisabled = (isWorkflowDropDisabled: boolean, isDropDisabled: boolean | undefined) =>
  isWorkflowDropDisabled || !!isDropDisabled;

const getShouldExpand = (groupIssueCount: number, isExpanded: boolean, groupBy: TIssueGroupByOptions | null) =>
  (!!groupIssueCount && isExpanded) || !groupBy;

const getIsIssueCreationDisabled = (
  disableIssueCreation: boolean | undefined,
  isGroupByCreatedBy: boolean,
  isCompletedCycle: boolean | undefined,
  isWorkflowIssueCreationDisabled: boolean
) => Boolean(disableIssueCreation || isGroupByCreatedBy || isCompletedCycle || isWorkflowIssueCreationDisabled);

const getIsStickyHeaderVisible = (isExpanded: boolean, groupIssueCount: number) => isExpanded && groupIssueCount > 0;

const getIsDangerDropIndicatorVisible = (isDraggingOverColumn: boolean, isDropDisabled: boolean) =>
  isDraggingOverColumn && isDropDisabled;

const getDragColumnOrientation = (sourceIndex: number, currentIndex: number): TDragColumnOrientation =>
  sourceIndex > currentIndex ? "justify-end" : "justify-start";

const handleGroupDrag = (
  payload: TDragPayload,
  params: {
    groupId: string;
    issuesMap: TIssueMap;
    getGroupIndex: (groupId: string | undefined) => number;
    handleWorkFlowState: TWorkflowStateHandler;
    setDragColumnOrientation: (orientation: TDragColumnOrientation) => void;
  }
) => {
  const source = payload.source;
  const sourceGroupId = source?.data?.groupId as string | undefined;

  if (sourceGroupId) {
    params.handleWorkFlowState(
      sourceGroupId,
      params.groupId,
      undefined,
      undefined,
      params.issuesMap[String(source.data.id)]?.type_id
    );
  }

  params.setDragColumnOrientation(
    getDragColumnOrientation(params.getGroupIndex(sourceGroupId), params.getGroupIndex(params.groupId))
  );
};

const showDropDisabledWarning = (dropErrorMessage: string | undefined, t: TTranslator) => {
  if (!dropErrorMessage) return;

  setToast({
    type: "warning",
    title: t("common.warning"),
    message: dropErrorMessage,
  });
};

const handleGroupDrop = (
  payload: TDropPayload,
  params: {
    group: IGroupByColumn;
    orderBy: TIssueOrderByOptions | undefined;
    isExpanded: boolean;
    isDropDisabled: boolean;
    handleOnDrop: (source: GroupDropLocation, destination: GroupDropLocation) => Promise<void>;
    handleCollapsedGroups: (value: string) => void;
    setIsDraggingOverColumn: (value: boolean) => void;
    t: TTranslator;
  }
) => {
  params.setIsDraggingOverColumn(false);
  const source = getSourceFromDropPayload(payload);
  const destination = getDestinationFromDropPayload(payload);

  if (!source || !destination) return;

  if (params.isDropDisabled) {
    showDropDisabledWarning(params.group.dropErrorMessage, params.t);
    return;
  }

  params.handleOnDrop(source, destination);

  highlightIssueOnDrop(getIssueBlockId(source.id, destination.groupId), params.orderBy !== "sort_order");

  if (!params.isExpanded) {
    params.handleCollapsedGroups(params.group.id);
  }
};

const registerGroupDropTarget = (
  element: HTMLDivElement | null,
  isGroupVisible: boolean,
  params: {
    groupId: string;
    setIsDraggingOverColumn: (value: boolean) => void;
    handleDrag: (payload: TDragPayload) => void;
    handleDrop: (payload: TDropPayload) => void;
  }
) => {
  if (!element || !isGroupVisible) return;

  return dropTargetForElements({
    element,
    getData: () => ({ groupId: params.groupId, type: "COLUMN" }),
    onDragEnter: () => params.setIsDraggingOverColumn(true),
    onDragLeave: () => params.setIsDraggingOverColumn(false),
    onDragStart: () => params.setIsDraggingOverColumn(true),
    onDrag: (payload) => params.handleDrag(payload),
    onDrop: (payload) => params.handleDrop(payload),
  });
};

function GroupLoadMore({
  groupId,
  isPaginating,
  loadMoreIssues,
}: {
  groupId: string;
  isPaginating: boolean;
  loadMoreIssues: (groupId?: string) => void;
}) {
  const { t } = useTranslation();

  if (isPaginating) return <ListLoaderItemRow />;

  return (
    <button
      type="button"
      className={
        "relative flex h-11 w-full cursor-pointer items-center gap-3 border border-transparent border-t-subtle-1 bg-surface-1 p-3 pl-8 text-13 font-medium text-accent-primary hover:text-accent-secondary hover:underline"
      }
      onClick={() => loadMoreIssues(groupId)}
    >
      {t("common.load_more")} &darr;
    </button>
  );
}

function GroupLoadMoreSection({
  shouldLoadMore,
  groupBy,
  groupId,
  isPaginating,
  loadMoreIssues,
  setIntersectionElement,
}: {
  shouldLoadMore: boolean;
  groupBy: TIssueGroupByOptions | null;
  groupId: string;
  isPaginating: boolean;
  loadMoreIssues: (groupId?: string) => void;
  setIntersectionElement: (element: HTMLDivElement | null) => void;
}) {
  if (!shouldLoadMore) return null;

  if (groupBy) {
    return <GroupLoadMore groupId={groupId} isPaginating={isPaginating} loadMoreIssues={loadMoreIssues} />;
  }

  return (
    <>
      {Array.from({ length: 2 }).map((_, index) => (
        // oxlint-disable-next-line react/no-array-index-key
        <ListLoaderItemRow key={index} />
      ))}
      <ListLoaderItemRow ref={setIntersectionElement} />
    </>
  );
}

type TGroupIssueBlocksProps = Pick<
  Props,
  | "issuesMap"
  | "updateIssue"
  | "quickActions"
  | "displayProperties"
  | "canEditProperties"
  | "containerRef"
  | "selectionHelpers"
> & {
  issueIds: string[] | undefined;
  groupId: string;
  isDragAllowed: boolean;
  canDropOverIssue: boolean;
};

function GroupIssueBlocks({ issueIds, groupId, ...rest }: TGroupIssueBlocksProps) {
  if (!issueIds) return null;

  return <IssueBlocksList issueIds={issueIds} groupId={groupId} {...rest} />;
}

const QuickAddSection = observer(function QuickAddSection({
  enabled,
  groupBy,
  groupId,
  projectState,
  quickAddCallback,
}: {
  enabled: boolean;
  groupBy: TIssueGroupByOptions | null;
  groupId: string;
  projectState: TProjectState;
  quickAddCallback: Props["quickAddCallback"];
}) {
  if (!enabled) return null;

  const defaultStateId = projectState.projectStates?.find((state) => state.default)?.id;

  return (
    <div className="sticky bottom-0 z-[1] w-full flex-shrink-0">
      <QuickAddIssueRoot
        layout={EIssueLayoutTypes.LIST}
        QuickAddButton={ListQuickAddIssueButton}
        prePopulatedData={getPrePopulatedQuickAddData(groupBy, groupId, defaultStateId)}
        containerClassName="border-b border-t border-subtle bg-surface-1 "
        quickAddCallback={quickAddCallback}
      />
    </div>
  );
});

export const ListGroup = observer(function ListGroup(props: Props) {
  const {
    groupIssueIds = EMPTY_ISSUE_IDS,
    group,
    issuesMap,
    group_by,
    orderBy,
    getGroupIndex,
    updateIssue,
    quickActions,
    displayProperties,
    enableIssueQuickAdd,
    canEditProperties,
    containerRef,
    quickAddCallback,
    handleOnDrop,
    disableIssueCreation,
    addIssuesToView,
    isCompletedCycle,
    showEmptyGroup,
    loadMoreIssues,
    selectionHelpers,
    handleCollapsedGroups,
    collapsedGroups,
  } = props;

  const [isDraggingOverColumn, setIsDraggingOverColumn] = useState(false);
  const [dragColumnOrientation, setDragColumnOrientation] = useState<TDragColumnOrientation>("justify-start");
  const isExpanded = getIsGroupExpanded(collapsedGroups, group.id);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const { t } = useTranslation();
  const projectState = useProjectState();

  const {
    issues: { getGroupIssueCount, getPaginationData, getIssueLoader },
  } = useIssuesStore();

  const [intersectionElement, setIntersectionElement] = useState<HTMLDivElement | null>(null);

  const { workflowDisabledSource, isWorkflowDropDisabled, handleWorkFlowState, getIsWorkflowWorkItemCreationDisabled } =
    useWorkFlowFDragNDrop(group_by);
  const isWorkflowIssueCreationDisabled = getIsWorkflowWorkItemCreationDisabled(group.id);

  const groupIssueCount = getGroupIssueCount(group.id, undefined, false) ?? 0;
  const nextPageResults = getPaginationData(group.id, undefined)?.nextPageResults;
  const isPaginating = !!getIssueLoader(group.id);

  useIntersectionObserver(containerRef, isPaginating ? null : intersectionElement, loadMoreIssues, `100% 0% 100% 0%`);

  const shouldLoadMore = getShouldLoadMore(nextPageResults, groupIssueCount, groupIssueIds);
  const isDropDisabled = getIsDropDisabled(isWorkflowDropDisabled, group.isDropDisabled);

  const handleDrag = useEffectEvent((payload: TDragPayload) => {
    handleGroupDrag(payload, {
      groupId: group.id,
      issuesMap,
      getGroupIndex,
      handleWorkFlowState,
      setDragColumnOrientation,
    });
  });
  const handleDrop = useEffectEvent((payload: TDropPayload) => {
    handleGroupDrop(payload, {
      group,
      orderBy,
      isExpanded,
      isDropDisabled,
      handleOnDrop,
      handleCollapsedGroups,
      setIsDraggingOverColumn,
      t,
    });
  });

  const isGroupVisible = getIsGroupVisible(showEmptyGroup, groupIssueCount);

  useEffect(() => {
    return registerGroupDropTarget(groupRef.current, isGroupVisible, {
      groupId: group.id,
      setIsDraggingOverColumn,
      handleDrag,
      handleDrop,
    });
  }, [group.id, isGroupVisible]);

  const isDragAllowed = getIsDragAllowed(group_by);
  const canOverlayBeVisible = getCanOverlayBeVisible(isWorkflowDropDisabled, orderBy, group.isDropDisabled);
  const isGroupByCreatedBy = group_by === "created_by";
  const shouldExpand = getShouldExpand(groupIssueCount, isExpanded, group_by);
  const finishVisibilityTransition = useCollapsibleVisibilityUpdates(shouldExpand);
  const isIssueCreationDisabled = getIsIssueCreationDisabled(
    disableIssueCreation,
    isGroupByCreatedBy,
    isCompletedCycle,
    isWorkflowIssueCreationDisabled
  );
  const isQuickAddEnabled = enableIssueQuickAdd && !isIssueCreationDisabled;
  const isStickyHeaderVisible = getIsStickyHeaderVisible(isExpanded, groupIssueCount);
  const isDangerDropIndicatorVisible = getIsDangerDropIndicatorVisible(isDraggingOverColumn, isDropDisabled);

  if (!isGroupVisible) return null;

  return (
    <Collapsible.Root
      open={shouldExpand}
      ref={groupRef}
      className={cn(`relative flex flex-shrink-0 flex-col`, {
        "border-b border-subtle": shouldExpand,
        "border-accent-strong": isDraggingOverColumn,
        "border-danger-subtle": isDangerDropIndicatorVisible,
      })}
    >
      <Row
        className={cn("w-full flex-shrink-0 border-b border-subtle bg-layer-1 py-1 pr-3 hover:bg-layer-1-hover", {
          "sticky top-0 z-[2]": isStickyHeaderVisible,
        })}
      >
        <HeaderGroupByCard
          isExpanded={isExpanded}
          groupID={group.id}
          groupBy={group_by}
          icon={group.icon}
          title={group.name}
          count={groupIssueCount}
          issuePayload={group.payload}
          canEditProperties={canEditProperties}
          disableIssueCreation={isIssueCreationDisabled}
          addIssuesToView={addIssuesToView}
          selectionHelpers={selectionHelpers}
          handleCollapsedGroups={handleCollapsedGroups}
        />
      </Row>
      <Collapsible.Panel
        keepMounted
        inert={!shouldExpand}
        className="motion-reduce:transition-none"
        onTransitionEnd={finishVisibilityTransition}
        render={<CollapsiblePanel />}
      >
        <div className="relative">
          <GroupDragOverlay
            dragColumnOrientation={dragColumnOrientation}
            canOverlayBeVisible={canOverlayBeVisible}
            isDropDisabled={isDropDisabled}
            workflowDisabledSource={workflowDisabledSource}
            dropErrorMessage={group.dropErrorMessage}
            orderBy={orderBy}
            isDraggingOverColumn={isDraggingOverColumn}
          />
          <GroupIssueBlocks
            issueIds={groupIssueIds}
            groupId={group.id}
            issuesMap={issuesMap}
            updateIssue={updateIssue}
            quickActions={quickActions}
            displayProperties={displayProperties}
            canEditProperties={canEditProperties}
            containerRef={containerRef}
            isDragAllowed={isDragAllowed}
            canDropOverIssue={!canOverlayBeVisible}
            selectionHelpers={selectionHelpers}
          />

          <GroupLoadMoreSection
            shouldLoadMore={shouldLoadMore}
            groupBy={group_by}
            groupId={group.id}
            isPaginating={isPaginating}
            loadMoreIssues={loadMoreIssues}
            setIntersectionElement={setIntersectionElement}
          />

          <QuickAddSection
            enabled={isQuickAddEnabled}
            groupBy={group_by}
            groupId={group.id}
            projectState={projectState}
            quickAddCallback={quickAddCallback}
          />
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
});
