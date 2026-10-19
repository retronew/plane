/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, MouseEvent, RefObject, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/utils/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { ChevronRightOutline } from "@makeplane/propel/icons";
// types
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssue, IIssueDisplayProperties, TIssueMap } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
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

interface IssueBlockProps {
  issueId: string;
  issuesMap: TIssueMap;
  groupId: string;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  displayProperties: IIssueDisplayProperties | undefined;
  canEditProperties: (projectId: string | undefined) => boolean;
  nestingLevel: number;
  spacingLeft?: number;
  isExpanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  selectionHelpers: TSelectionHelper;
  isCurrentBlockDragging: boolean;
  setIsCurrentBlockDragging: React.Dispatch<React.SetStateAction<boolean>>;
  canDrag: boolean;
  isEpic?: boolean;
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

type TToggleIssueExpandArgs = {
  event: MouseEvent<HTMLButtonElement>;
  issue: TIssue;
  nestingLevel: number;
  workspaceSlug: string | undefined;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  fetchSubIssues: (workspaceSlug: string, projectId: string, issueId: string) => unknown;
  onOpenPeek: (issue: TIssue) => void;
};

function toggleIssueExpand({
  event,
  issue,
  nestingLevel,
  workspaceSlug,
  setExpanded,
  fetchSubIssues,
  onOpenPeek,
}: TToggleIssueExpandArgs) {
  event.stopPropagation();
  event.preventDefault();
  if (nestingLevel >= 3) {
    onOpenPeek(issue);
    return;
  }
  setExpanded((prevState) => {
    if (!prevState && workspaceSlug && issue.project_id) {
      fetchSubIssues(workspaceSlug, issue.project_id, issue.id);
    }
    return !prevState;
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
    "group/list-block relative flex min-h-11 flex-col gap-3 bg-layer-transparent py-3 text-13 transition-colors hover:bg-layer-transparent-hover",
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
  isEpic: boolean;
  groupId: string;
  selectionHelpers: TSelectionHelper;
  isIssueSelected: boolean;
};

const IssueBlockSelection = observer(function IssueBlockSelection({
  issue,
  projectId,
  canSelectIssues,
  isEpic,
  groupId,
  selectionHelpers,
  isIssueSelected,
}: TIssueBlockSelectionProps) {
  if (!projectId || !canSelectIssues || isEpic) return null;

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

type TIssueBlockSubIssuesToggleProps = {
  subIssuesCount: number;
  isEpic: boolean;
  isExpanded: boolean;
  onToggleExpand: (event: MouseEvent<HTMLButtonElement>) => void;
};

function IssueBlockSubIssuesToggle({
  subIssuesCount,
  isEpic,
  isExpanded,
  onToggleExpand,
}: TIssueBlockSubIssuesToggleProps) {
  return (
    <div className="grid size-4 flex-shrink-0 place-items-center">
      {subIssuesCount > 0 && !isEpic && (
        <button
          type="button"
          className="grid size-4 place-items-center rounded-xs text-placeholder hover:text-tertiary"
          onClick={onToggleExpand}
        >
          <ChevronRightOutline
            className={cn("size-4", {
              "rotate-90": isExpanded,
            })}
          />
        </button>
      )}
    </div>
  );
}

type TIssueBlockLeftProps = {
  issue: TIssue;
  projectId: string | undefined;
  canSelectIssues: boolean;
  isEpic: boolean;
  groupId: string;
  selectionHelpers: TSelectionHelper;
  isIssueSelected: boolean;
  displayProperties: IIssueDisplayProperties | undefined;
  projectIdentifier: string | undefined;
  subIssuesCount: number;
  isExpanded: boolean;
  onToggleExpand: (event: MouseEvent<HTMLButtonElement>) => void;
  isSubIssue: boolean;
  marginLeft: string;
  isCurrentBlockDragging: boolean;
  isMobile: boolean;
};

const IssueBlockLeft = observer(function IssueBlockLeft({
  issue,
  projectId,
  canSelectIssues,
  isEpic,
  groupId,
  selectionHelpers,
  isIssueSelected,
  displayProperties,
  projectIdentifier,
  subIssuesCount,
  isExpanded,
  onToggleExpand,
  isSubIssue,
  marginLeft,
  isCurrentBlockDragging,
  isMobile,
}: TIssueBlockLeftProps) {
  return (
    <div className="flex flex-grow items-center gap-0.5 truncate">
      <div className="flex items-center gap-1" style={isSubIssue ? { marginLeft } : {}}>
        {/* select checkbox */}
        <IssueBlockSelection
          issue={issue}
          projectId={projectId}
          canSelectIssues={canSelectIssues}
          isEpic={isEpic}
          groupId={groupId}
          selectionHelpers={selectionHelpers}
          isIssueSelected={isIssueSelected}
        />
        {displayProperties?.key && issue.project_id && (
          <ListIssueIdentifier identifier={`${projectIdentifier}-${issue.sequence_id}`} />
        )}

        {/* sub-issues chevron */}
        <IssueBlockSubIssuesToggle
          subIssuesCount={subIssuesCount}
          isEpic={isEpic}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
        />

        {issue.tempId !== undefined && (
          <div className="absolute top-0 left-0 z-[99999] h-full w-full animate-pulse bg-surface-1/20" />
        )}
      </div>

      <Tooltip label={issue.name} layout="stacked" align="start" disabled={isCurrentBlockDragging || isMobile}>
        <p className="cursor-pointer truncate text-body-xs-medium text-primary">{issue.name}</p>
      </Tooltip>
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
  isEpic: boolean;
  isSidebarCollapsed: boolean | undefined;
  quickActions: TRenderQuickActions;
  issueRef: RefObject<HTMLDivElement | null>;
};

const IssueBlockPropertiesSection = observer(function IssueBlockPropertiesSection({
  issue,
  updateIssue,
  displayProperties,
  canEditIssueProperties,
  isEpic,
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
            displayProperties={displayProperties}
            activeLayout="List"
            isEpic={isEpic}
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
    spacingLeft = 14,
    isExpanded,
    setExpanded,
    selectionHelpers,
    isCurrentBlockDragging,
    setIsCurrentBlockDragging,
    canDrag,
    isEpic = false,
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
  const {
    getIsIssuePeeked,
    peekIssue,
    setPeekIssue,
    subIssues: subIssuesStore,
  } = useIssueDetail(isEpic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES);

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
  const isSubIssue = nestingLevel !== 0;
  const canSelectIssues = canEditIssueProperties && !selectionHelpers.isSelectionDisabled;
  const isIssuePeeked = getIsIssuePeeked(issue.id);
  const isIssuePeekedHere = isIssuePeeked && peekIssue?.nestingLevel === nestingLevel;

  const marginLeft = `${spacingLeft}px`;

  const handleIssuePeekOverview = (targetIssue: TIssue) =>
    openIssuePeek({ issue: targetIssue, workspaceSlug, nestingLevel, getIsIssuePeeked, setPeekIssue });

  const handleToggleExpand = (event: MouseEvent<HTMLButtonElement>) =>
    toggleIssueExpand({
      event,
      issue,
      nestingLevel,
      workspaceSlug,
      setExpanded,
      fetchSubIssues: subIssuesStore.fetchSubIssues,
      onOpenPeek: handleIssuePeekOverview,
    });

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issue?.sequence_id,
    isEpic,
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
        <div className="flex w-full gap-2 truncate">
          <IssueBlockLeft
            issue={issue}
            projectId={projectId}
            canSelectIssues={canSelectIssues}
            isEpic={isEpic}
            groupId={groupId}
            selectionHelpers={selectionHelpers}
            isIssueSelected={isIssueSelected}
            displayProperties={displayProperties}
            projectIdentifier={projectIdentifier}
            subIssuesCount={issue.sub_issues_count ?? 0}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
            isSubIssue={isSubIssue}
            marginLeft={marginLeft}
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
          isEpic={isEpic}
          isSidebarCollapsed={isSidebarCollapsed}
          quickActions={quickActions}
          issueRef={issueRef}
        />
      </Row>
    </ControlLink>
  );
});
