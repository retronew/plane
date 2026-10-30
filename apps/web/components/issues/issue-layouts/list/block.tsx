/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/utils/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { IssueTreeLines } from "./tree-lines";
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { SubIssuesProgress } from "./sub-issues-progress";
// types
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssue, IIssueDisplayProperties, TIssueMap } from "@plane/types";
// ui
import { ControlLink, Row } from "@plane/blocks/layout";
import { Spinner } from "@plane/blocks/spinner";
import { cn, generateWorkItemLink } from "@plane/utils";
// components
import { MultipleSelectEntityAction } from "@/components/core/multiple-select";
import { IssueProperties } from "@/components/issues/issue-layouts/properties";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { usePlatformOS } from "@/hooks/use-platform-os";
import type { TPeekIssue } from "@/store/issue/issue-details/root.store";
import type { TRenderQuickActions } from "./list-view-types";
import { ListIssueIdentifier } from "../identifier";
import { translate } from "@plane/i18n";

const EMPTY_TREE_BRANCHES: boolean[] = [];

interface IssueBlockProps {
  issueId: string;
  issuesMap: TIssueMap;
  groupId: string;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  displayProperties: IIssueDisplayProperties | undefined;
  canEditProperties: (projectId: string | undefined) => boolean;
  treeBranches?: boolean[];
  hasTreeChildren?: boolean;
  nestingLevel: number;
  spacingLeft?: number;
  selectionHelpers: TSelectionHelper;
  isCurrentBlockDragging: boolean;
  setIsCurrentBlockDragging: React.Dispatch<React.SetStateAction<boolean>>;
  canDrag: boolean;
}

function showMoveWarning(canEditIssueProperties: boolean) {
  setToast({
    type: "warning",
    title: translate("web.cannot_move_work_item"),
    message: canEditIssueProperties
      ? translate("web.drag_and_drop_is_disabled_for_the_current_grouping")
      : translate("web.you_are_not_allowed_to_move_this_work_item"),
  });
}

type TOpenIssuePeekArgs = {
  issue: TIssue;
  workspaceSlug: string | undefined;
  nestingLevel: number;
  getIsIssuePeeked: (issueId: string) => boolean;
  setPeekIssue: (peekIssue: TPeekIssue) => void;
};

function openIssuePeek({ issue, workspaceSlug, nestingLevel, getIsIssuePeeked, setPeekIssue }: TOpenIssuePeekArgs) {
  if (!workspaceSlug || !issue.project_id || !issue.id || getIsIssuePeeked(issue.id)) return;
  setPeekIssue({
    workspaceSlug,
    projectId: issue.project_id,
    issueId: issue.id,
    nestingLevel: nestingLevel,
    isArchived: !!issue.archived_at,
  });
}

type TRowClassNameArgs = {
  isIssuePeeked: boolean;
  isIssuePeekedHere: boolean;
  isIssueActive: boolean;
  isIssueSelected: boolean;
  isCurrentBlockDragging: boolean;
  isSidebarCollapsed: boolean | undefined;
};

function getRowClassName({
  isIssuePeeked,
  isIssuePeekedHere,
  isIssueActive,
  isIssueSelected,
  isCurrentBlockDragging,
  isSidebarCollapsed,
}: TRowClassNameArgs) {
  return cn(
    "group/list-block relative flex min-h-11 flex-col gap-2 bg-layer-transparent py-1 text-13 transition-colors hover:bg-layer-transparent-hover",
    {
      "border-accent-strong": isIssuePeekedHere,
      "border-strong-1": isIssueActive,
      "last:border-b-transparent": !isIssuePeeked && !isIssueActive,
      "bg-accent-primary/5 hover:bg-accent-primary/10": isIssueSelected,
      "bg-layer-1": isCurrentBlockDragging,
      "md:flex-row md:items-center": isSidebarCollapsed,
      "lg:flex-row lg:items-center": !isSidebarCollapsed,
    }
  );
}

type TUseIssueBlockDraggableArgs = {
  elementRef: RefObject<HTMLDivElement | null>;
  isDraggingAllowed: boolean;
  issueId: string;
  groupId: string;
  setIsCurrentBlockDragging: Dispatch<SetStateAction<boolean>>;
};

function useIssueBlockDraggable({
  elementRef,
  isDraggingAllowed,
  issueId,
  groupId,
  setIsCurrentBlockDragging,
}: TUseIssueBlockDraggableArgs) {
  useEffect(() => {
    const element = elementRef.current;

    if (!element) return;

    return combine(
      draggable({
        element,
        canDrag: () => isDraggingAllowed,
        getInitialData: () => ({ id: issueId, type: "ISSUE", groupId }),
        onDragStart: () => {
          setIsCurrentBlockDragging(true);
        },
        onDrop: () => {
          setIsCurrentBlockDragging(false);
        },
      })
    );
  }, [isDraggingAllowed, issueId, groupId, setIsCurrentBlockDragging, elementRef]);
}

type TIssueBlockSelectionProps = {
  issue: TIssue;
  projectId: string | undefined;
  canSelectIssues: boolean;
  groupId: string;
  selectionHelpers: TSelectionHelper;
  isIssueSelected: boolean;
};

const IssueBlockSelection = observer(function IssueBlockSelection({
  issue,
  projectId,
  canSelectIssues,
  groupId,
  selectionHelpers,
  isIssueSelected,
}: TIssueBlockSelectionProps) {
  if (!projectId || !canSelectIssues) return null;

  return (
    <Tooltip
      label={translate("web.only_work_items_within_the_current_project_can_be_selected")}
      layout="stacked"
      disabled={issue.project_id === projectId}
    >
      <div className="absolute left-1 grid w-3.5 flex-shrink-0 place-items-center">
        <MultipleSelectEntityAction
          className={cn(
            "pointer-events-none opacity-0 transition-opacity group-hover/list-block:pointer-events-auto group-hover/list-block:opacity-100",
            {
              "pointer-events-auto opacity-100": isIssueSelected,
            }
          )}
          groupId={groupId}
          id={issue.id}
          selectionHelpers={selectionHelpers}
          disabled={issue.project_id !== projectId}
        />
      </div>
    </Tooltip>
  );
});

type TIssueBlockLeftProps = {
  issue: TIssue;
  projectId: string | undefined;
  canSelectIssues: boolean;
  groupId: string;
  selectionHelpers: TSelectionHelper;
  isIssueSelected: boolean;
  displayProperties: IIssueDisplayProperties | undefined;
  projectIdentifier: string | undefined;
  subIssuesCount: number;
  treeBranches: boolean[];
  hasTreeChildren: boolean;
  workspaceSlug?: string;
  updateIssue: IssueBlockProps["updateIssue"];
  canEdit: boolean;
  isCurrentBlockDragging: boolean;
  isMobile: boolean;
};

const IssueBlockLeft = observer(function IssueBlockLeft({
  issue,
  projectId,
  canSelectIssues,
  groupId,
  selectionHelpers,
  isIssueSelected,
  displayProperties,
  projectIdentifier,
  subIssuesCount,
  treeBranches,
  hasTreeChildren,
  workspaceSlug,
  updateIssue,
  canEdit,
  isCurrentBlockDragging,
  isMobile,
}: TIssueBlockLeftProps) {
  return (
    <div className="relative flex min-h-9 min-w-0 flex-grow items-center gap-2 [&_[data-list-identifier]]:w-[var(--issue-list-identifier-width)] [&_[data-list-identifier]]:text-[13px]">
      <div className="flex shrink-0 items-center gap-2 self-stretch">
        <IssueTreeLines branches={treeBranches} hasChildren={hasTreeChildren} />
        <PrioritySelect
          value={issue.priority}
          variant="icon-sm"
          className="h-9 w-4 min-w-4 rounded-sm p-0"
          tooltip
          disabled={!canEdit || !!issue.tempId}
          onChange={(priority) => {
            void updateIssue?.(issue.project_id, issue.id, { priority });
          }}
        />
        {/* select checkbox */}
        <IssueBlockSelection
          issue={issue}
          projectId={projectId}
          canSelectIssues={canSelectIssues}
          groupId={groupId}
          selectionHelpers={selectionHelpers}
          isIssueSelected={isIssueSelected}
        />
        {displayProperties?.key && issue.project_id && (
          <ListIssueIdentifier identifier={`${projectIdentifier}-${issue.sequence_id}`} />
        )}

        <StateSelect
          value={issue.state_id}
          projectId={issue.project_id ?? undefined}
          variant="icon-sm"
          className="h-9 w-4 min-w-4 rounded-sm p-0"
          tooltip
          disabled={!canEdit || !!issue.tempId}
          onChange={(state_id) => {
            void updateIssue?.(issue.project_id, issue.id, { state_id });
          }}
        />

        {issue.tempId !== undefined && (
          <div className="absolute top-0 left-0 z-[99999] h-full w-full animate-pulse bg-surface-1/20" />
        )}
      </div>

      <Tooltip label={issue.name} layout="stacked" align="start" disabled={isCurrentBlockDragging || isMobile}>
        <p className="cursor-pointer truncate text-body-xs-medium text-primary">{issue.name}</p>
      </Tooltip>
      <SubIssuesProgress
        issueId={issue.id}
        projectId={issue.project_id}
        workspaceSlug={workspaceSlug}
        total={subIssuesCount}
      />
    </div>
  );
});

type TIssueBlockQuickActionsProps = {
  issue: TIssue;
  issueRef: RefObject<HTMLDivElement | null>;
  quickActions: TRenderQuickActions;
  isSidebarCollapsed: boolean | undefined;
};

const IssueBlockQuickActions = observer(function IssueBlockQuickActions({
  issue,
  issueRef,
  quickActions,
  isSidebarCollapsed,
}: TIssueBlockQuickActionsProps) {
  return (
    <div
      className={cn("block rounded-sm border border-strong", {
        "md:hidden": isSidebarCollapsed,
        "lg:hidden": !isSidebarCollapsed,
      })}
    >
      {quickActions({
        issue,
        parentRef: issueRef,
      })}
    </div>
  );
});

type TIssueBlockPropertiesSectionProps = {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  canEditIssueProperties: boolean;
  isSidebarCollapsed: boolean | undefined;
  quickActions: TRenderQuickActions;
  issueRef: RefObject<HTMLDivElement | null>;
};

const IssueBlockPropertiesSection = observer(function IssueBlockPropertiesSection({
  issue,
  updateIssue,
  displayProperties,
  canEditIssueProperties,
  isSidebarCollapsed,
  quickActions,
  issueRef,
}: TIssueBlockPropertiesSectionProps) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      {!issue.tempId ? (
        <>
          <IssueProperties
            className={`relative flex flex-wrap ${isSidebarCollapsed ? "md:flex-shrink-0 md:flex-grow" : "lg:flex-shrink-0 lg:flex-grow"} items-center gap-2 whitespace-nowrap`}
            issue={issue}
            isReadOnly={!canEditIssueProperties}
            updateIssue={updateIssue}
            displayProperties={
              displayProperties
                ? { ...displayProperties, priority: false, state: false, sub_issue_count: false }
                : displayProperties
            }
            activeLayout="List"
          />
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div
            className={cn("hidden", {
              "md:flex": isSidebarCollapsed,
              "lg:flex": !isSidebarCollapsed,
            })}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {quickActions({
              issue,
              parentRef: issueRef,
            })}
          </div>
        </>
      ) : (
        <div className="h-4 w-4">
          <Spinner className="h-4 w-4" />
        </div>
      )}
    </div>
  );
});

export const IssueBlock = observer(function IssueBlock(props: IssueBlockProps) {
  const {
    issuesMap,
    issueId,
    groupId,
    updateIssue,
    quickActions,
    displayProperties,
    canEditProperties,
    nestingLevel,
    selectionHelpers,
    isCurrentBlockDragging,
    setIsCurrentBlockDragging,
    canDrag,
  } = props;
  // ref
  const issueRef = useRef<HTMLDivElement | null>(null);
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  // hooks
  const { sidebarCollapsed: isSidebarCollapsed } = useAppTheme();
  const { getProjectIdentifierById } = useProject();
  const { getIsIssuePeeked, peekIssue, setPeekIssue } = useIssueDetail();

  // derived values
  const issue = issuesMap[issueId];
  const canEditIssueProperties = canEditProperties(issue?.project_id ?? undefined);
  const isDraggingAllowed = canDrag && canEditIssueProperties;

  const { isMobile } = usePlatformOS();

  useIssueBlockDraggable({
    elementRef: issueRef,
    isDraggingAllowed,
    issueId,
    groupId,
    setIsCurrentBlockDragging,
  });

  if (!issue) return null;

  const projectIdentifier = getProjectIdentifierById(issue.project_id);
  const isIssueSelected = selectionHelpers.getIsEntitySelected(issue.id);
  const isIssueActive = selectionHelpers.getIsEntityActive(issue.id);
  const canSelectIssues = canEditIssueProperties && !selectionHelpers.isSelectionDisabled;
  const isIssuePeeked = getIsIssuePeeked(issue.id);
  const isIssuePeekedHere = isIssuePeeked && peekIssue?.nestingLevel === nestingLevel;

  const handleIssuePeekOverview = (targetIssue: TIssue) =>
    openIssuePeek({ issue: targetIssue, workspaceSlug, nestingLevel, getIsIssuePeeked, setPeekIssue });

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issue?.sequence_id,
    isArchived: !!issue?.archived_at,
  });
  return (
    <ControlLink
      id={`issue-${issue.id}`}
      href={workItemLink}
      onClick={() => handleIssuePeekOverview(issue)}
      className="w-full cursor-pointer"
      disabled={!!issue.tempId || issue.is_draft}
    >
      <Row
        ref={issueRef}
        data-issue-list-row=""
        className={getRowClassName({
          isIssuePeeked,
          isIssuePeekedHere,
          isIssueActive,
          isIssueSelected,
          isCurrentBlockDragging,
          isSidebarCollapsed,
        })}
        onDragStart={() => {
          if (!isDraggingAllowed) {
            showMoveWarning(canEditIssueProperties);
          }
        }}
      >
        <div className="flex w-full min-w-0 gap-2 self-stretch">
          <IssueBlockLeft
            issue={issue}
            projectId={projectId}
            canSelectIssues={canSelectIssues}
            groupId={groupId}
            selectionHelpers={selectionHelpers}
            isIssueSelected={isIssueSelected}
            displayProperties={displayProperties}
            projectIdentifier={projectIdentifier}
            subIssuesCount={issue.sub_issues_count ?? 0}
            treeBranches={props.treeBranches ?? EMPTY_TREE_BRANCHES}
            hasTreeChildren={props.hasTreeChildren ?? false}
            workspaceSlug={workspaceSlug}
            updateIssue={updateIssue}
            canEdit={canEditIssueProperties}
            isCurrentBlockDragging={isCurrentBlockDragging}
            isMobile={isMobile}
          />
          {!issue.tempId && (
            <IssueBlockQuickActions
              issue={issue}
              issueRef={issueRef}
              quickActions={quickActions}
              isSidebarCollapsed={isSidebarCollapsed}
            />
          )}
        </div>
        <IssueBlockPropertiesSection
          issue={issue}
          updateIssue={updateIssue}
          displayProperties={displayProperties}
          canEditIssueProperties={canEditIssueProperties}
          isSidebarCollapsed={isSidebarCollapsed}
          quickActions={quickActions}
          issueRef={issueRef}
        />
      </Row>
    </ControlLink>
  );
});
