/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane helpers
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
import { useOutsideClickDetector } from "@plane/hooks";
// types
import { SelectDropdownPlacementContext } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssue, IIssueDisplayProperties, IIssueMap } from "@plane/types";
// ui
import { ControlLink } from "@plane/blocks/layout";
import { cn, generateWorkItemLink } from "@plane/utils";
// components
import { HIGHLIGHT_CLASS, getIssueBlockId } from "@/components/issues/issue-layouts/utils";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local components
import type { TRenderQuickActions } from "../list/list-view-types";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { IssueProperties } from "../properties/all-properties";
import { IssuePropertyLabels } from "../properties/labels";
import { IssueHierarchyIndicator } from "../hierarchy-indicator";
import { splitKanbanCardProperties } from "./card-layout";
import { KanbanCardProgress, getSubWorkItemProgress } from "./card-progress";
import { useKanbanSortableCard } from "./kanban-dnd";
import { translate, useTranslation } from "@plane/i18n";
import { MemberSelect } from "@/components/dropdowns/member/member-select";

// the footer has room for every face, so the stack never collapses into a "+N" count
const KANBAN_MAX_ASSIGNEE_AVATARS = 99;
/** Every card chip is filled grey without an outline, with one 8px radius inside the 12px card. */
const FILLED_PILL_CLASSNAME =
  "[&_.group]:rounded-lg [&_.group]:border-transparent [&_.group]:bg-layer-1 [&_.group]:hover:border-transparent [&_.group]:hover:bg-layer-3";
// the footer date keeps the stronger fill so the "when" stays easy to spot
const FOOTER_PILL_CLASSNAME =
  "[&_.group]:rounded-lg [&_.group]:border-transparent [&_.group]:bg-layer-3 [&_.group]:hover:border-transparent [&_.group]:hover:bg-layer-3-hover";
/** Each priority is tinted, on hover too, with its own colour: the label, the icon and a soft fill behind them. */
const PRIORITY_PILL_CLASSNAME: Record<string, string> = {
  urgent:
    "[&_button]:bg-[color-mix(in_oklab,var(--text-color-priority-urgent)_12%,transparent)] [&_button]:text-priority-urgent [&_button]:hover:bg-[color-mix(in_oklab,var(--text-color-priority-urgent)_20%,transparent)]",
  high: "[&_button]:bg-[color-mix(in_oklab,var(--text-color-priority-high)_12%,transparent)] [&_button]:text-priority-high [&_button]:hover:bg-[color-mix(in_oklab,var(--text-color-priority-high)_20%,transparent)]",
  medium:
    "[&_button]:bg-[color-mix(in_oklab,var(--text-color-priority-medium)_12%,transparent)] [&_button]:text-priority-medium [&_button]:hover:bg-[color-mix(in_oklab,var(--text-color-priority-medium)_20%,transparent)]",
  low: "[&_button]:bg-[color-mix(in_oklab,var(--text-color-priority-low)_12%,transparent)] [&_button]:text-priority-low [&_button]:hover:bg-[color-mix(in_oklab,var(--text-color-priority-low)_20%,transparent)]",
};
/** Shape of the priority chip, one step smaller than the body pills so the title leads; the colours come from PRIORITY_PILL_CLASSNAME. */
const PRIORITY_CHIP_CLASSNAME =
  "[&_button]:h-5 [&_button]:text-caption-md-medium [&_svg]:size-3 [&_button]:rounded-lg [&_button]:border-transparent [&_button]:hover:border-transparent";

const ASSIGNEE_DROPDOWN_PLACEMENT = { side: "bottom", align: "start" } as const;

interface IssueBlockProps {
  issueId: string;
  groupId: string;
  subGroupId: string;
  issuesMap: IIssueMap;
  displayProperties: IIssueDisplayProperties | undefined;
  draggableId: string;
  /** Position within its column, for dnd-kit's sortable. */
  index: number;
  /** The column the card is rendered in (where a dragged card currently previews). */
  columnId: string;
  canDragIssuesInCurrentGrouping: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  canEditProperties: (projectId: string | undefined) => boolean;
}

interface IssueDetailsBlockProps {
  cardRef: React.RefObject<HTMLElement | null>;
  issue: TIssue;
  displayProperties: IIssueDisplayProperties | undefined;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  quickActions: TRenderQuickActions;
  isReadOnly: boolean;
}

const KanbanIssueDetailsBlock = observer(function KanbanIssueDetailsBlock(props: IssueDetailsBlockProps) {
  const { cardRef, issue, updateIssue, quickActions, isReadOnly, displayProperties } = props;
  // refs
  const menuActionRef = useRef<HTMLButtonElement | null>(null);
  // states
  const [isMenuActive, setIsMenuActive] = useState(false);
  // hooks
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const parentIssue = issue.parent_id ? getIssueById(issue.parent_id) : undefined;

  const customActionButton = (
    // The quick-action menu grafts its trigger behaviour (and accessible name) onto this element via
    // MenuTrigger render, so it has to be a real button.
    <button
      type="button"
      ref={menuActionRef}
      className={cn(
        "flex size-5 cursor-pointer items-center justify-center rounded-md text-secondary hover:bg-layer-1-hover",
        { "bg-layer-1-hover text-primary": isMenuActive }
      )}
      onClick={() => setIsMenuActive(!isMenuActive)}
    >
      <MoreHorizontalOutline className="h-3.5 w-3.5" />
    </button>
  );

  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const handleEventPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  useOutsideClickDetector(menuActionRef, () => setIsMenuActive(false));

  // derived values: the body keeps the "what" pills, the footer the "who" and "when"
  const cardProperties = splitKanbanCardProperties(displayProperties);
  const progress = cardProperties.showProgress ? getSubWorkItemProgress(issue) : null;
  const showFooter = !!displayProperties?.assignee || cardProperties.showFooterProperties;
  // an unset priority would only add an empty "Priority" chip to every card; the menu still sets it
  const showPriority = !!cardProperties.header.priority && !!issue.priority && issue.priority !== "none";

  return (
    <>
      {/* header: the identifier and priority as filled chips on the left, the hover-only menu on the right */}
      <div className="flex min-h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {issue.project_id && (
            // click copies the identifier (with a toast) instead of opening the card
            // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
            <span
              className="inline-flex h-5 max-w-full shrink-0 items-center rounded-lg px-1.5 transition-colors hover:bg-layer-3 [&_*]:text-caption-md-medium"
              onClick={handleEventPropagation}
            >
              <IssueIdentifier
                enableClickToCopyIdentifier
                issueId={issue.id}
                projectId={issue.project_id}
                size="md"
                variant="tertiary"
                displayProperties={displayProperties}
              />
            </span>
          )}
          {showPriority && (
            <IssueProperties
              className={cn(
                "flex shrink-0 items-center",
                PRIORITY_CHIP_CLASSNAME,
                PRIORITY_PILL_CLASSNAME[issue.priority ?? ""]
              )}
              issue={issue}
              displayProperties={cardProperties.header}
              activeLayout="Kanban"
              updateIssue={updateIssue}
              isReadOnly={isReadOnly}
            />
          )}
          {/* the parent it rolls up to; its own sub-work items show in the progress row */}
          <IssueHierarchyIndicator parentId={issue.parent_id} parentName={parentIssue?.name ?? issue.parent?.name} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div
            className={cn("flex", {
              "invisible group-focus-within/kanban-block:visible group-hover/kanban-block:visible":
                !isMobile && !isMenuActive,
            })}
            onClick={handleEventPropagation}
          >
            {quickActions({
              issue,
              parentRef: cardRef,
              customActionButton,
            })}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Tooltip label={issue.name} layout="stacked" disabled={isMobile}>
          <div className="flex w-full items-start gap-1.5 text-body-sm-medium break-words text-primary">
            {/* the state as a bare icon before the title: changeable in place, without a pill of its own */}
            {cardProperties.showStateIcon && (
              // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
              <span className="flex h-[1lh] shrink-0 items-center" onClick={handleEventPropagation}>
                <StateSelect
                  issueTypeId={issue.type_id}
                  value={issue.state_id}
                  onChange={(stateId) => void updateIssue?.(issue.project_id, issue.id, { state_id: stateId })}
                  projectId={issue.project_id ?? undefined}
                  disabled={isReadOnly}
                  variant="icon-sm"
                  // a ghost button: no chrome at rest, a soft fill on hover
                  className="-my-0.5 -ms-1 size-6 justify-center rounded-md border-transparent bg-transparent p-0 transition-colors hover:border-transparent hover:bg-layer-3 aria-expanded:bg-layer-3"
                  tooltip
                />
              </span>
            )}
            <span className="min-w-0">{issue.name}</span>
          </div>
        </Tooltip>
      </div>

      {/* one wrapping row: the property pills flow straight on into the label chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <IssueProperties
          className={cn("contents whitespace-nowrap text-tertiary", FILLED_PILL_CLASSNAME)}
          issue={issue}
          displayProperties={cardProperties.body}
          activeLayout="Kanban"
          updateIssue={updateIssue}
          isReadOnly={isReadOnly}
        />
        {cardProperties.showLabels && (
          <IssuePropertyLabels
            // the same filled grey as the other properties, whether empty or showing label chips
            className={cn(
              "text-tertiary",
              !issue.label_ids?.length && FILLED_PILL_CLASSNAME,
              // label chips take the card's chip grey and type instead of the darker label palette
              "[&_.bg-label-grey-bg]:rounded-lg [&_.bg-label-grey-bg]:bg-layer-1 [&_.bg-label-grey-bg]:px-1.5 [&_.bg-label-grey-bg]:text-body-xs-regular [&_.bg-label-grey-bg]:text-secondary"
            )}
            projectId={issue.project_id ?? null}
            value={issue.label_ids ?? []}
            onChange={(labelIds) => void updateIssue?.(issue.project_id, issue.id, { label_ids: labelIds })}
            disabled={isReadOnly}
            pillVariant="pill-md"
            showAllLabels
          />
        )}
      </div>

      {progress && <KanbanCardProgress progress={progress} />}

      {showFooter && (
        // footer: a hairline divider, assignees on the left and the due date with counts on the right
        <div className="flex min-h-6 items-center justify-between gap-2 border-t border-subtle pt-1.5">
          {/* Stack the faces tighter than the shared avatar group and fan them out on hover. The overlap
              sits on each face after the first, so a newly added face mounts in place instead of
              animating the previous last one. */}
          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions */}
          <div
            hidden={!displayProperties?.assignee}
            className={cn(
              "isolate flex [&_[role=img]]:me-0 [&_[role=img]]:border-2 [&_[role=img]]:border-[var(--background-color-layer-2)] [&_[role=img]]:transition-[margin] [&_[role=img]]:duration-200 [&_[role=img]]:ease-[cubic-bezier(0.22,1,0.36,1)] [&_[role=img]:not(:first-child)]:-ms-2.5 hover:[&_[role=img]:not(:first-child)]:ms-0.5",
              // the first face sits on top, each later one tucks under the one before it
              "[&_[role=img]:nth-child(1)]:z-[6] [&_[role=img]:nth-child(2)]:z-[5] [&_[role=img]:nth-child(3)]:z-[4] [&_[role=img]:nth-child(4)]:z-[3] [&_[role=img]:nth-child(5)]:z-[2] [&_[role=img]:nth-child(6)]:z-[1]",
              // unassigned: a dashed avatar-sized circle that reads as an empty seat to fill
              !issue.assignee_ids?.length &&
                "[&_button]:size-5 [&_button]:justify-center [&_button]:rounded-full [&_button]:border [&_button]:border-dashed [&_button]:border-strong [&_button]:text-placeholder [&_button]:transition-colors [&_button]:hover:border-accent-strong [&_button]:hover:text-accent-primary [&_svg]:size-3"
            )}
            onClick={handleEventPropagation}
          >
            {/* Pin the popup to the left edge: the stack grows rightwards as assignees are picked. */}
            <SelectDropdownPlacementContext.Provider value={ASSIGNEE_DROPDOWN_PLACEMENT}>
              <MemberSelect
                projectId={issue.project_id ?? undefined}
                value={issue.assignee_ids ?? []}
                onChange={(assigneeIds) =>
                  void updateIssue?.(issue.project_id, issue.id, { assignee_ids: assigneeIds })
                }
                disabled={isReadOnly}
                multiple
                variant="avatar-group-sm"
                showLabel={false}
                hideChevron
                maxAvatars={KANBAN_MAX_ASSIGNEE_AVATARS}
                placeholder={t("common.assignees")}
                tooltip={{ heading: t("common.assignees") }}
              />
            </SelectDropdownPlacementContext.Provider>
          </div>
          {cardProperties.showFooterProperties && (
            <IssueProperties
              className={cn("ms-auto flex items-center gap-2 whitespace-nowrap text-tertiary", FOOTER_PILL_CLASSNAME)}
              issue={issue}
              displayProperties={cardProperties.footer}
              activeLayout="Kanban"
              updateIssue={updateIssue}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
      )}
    </>
  );
});

export const KanbanIssueBlock = observer(function KanbanIssueBlock(props: IssueBlockProps) {
  const {
    issueId,
    groupId,
    subGroupId,
    issuesMap,
    displayProperties,
    draggableId,
    index,
    columnId,
    canDragIssuesInCurrentGrouping,
    updateIssue,
    quickActions,
    canEditProperties,
  } = props;

  const cardRef = useRef<HTMLAnchorElement | null>(null);
  // where a press on a card that may not move started, to explain the refusal once it turns into a drag
  const lockedPointerRef = useRef<{ x: number; y: number } | null>(null);
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // hooks
  const { getProjectIdentifierById } = useProject();
  const { getIsIssuePeeked } = useIssueDetail();
  const { handleRedirection } = useIssuePeekOverviewRedirection();
  const { isMobile } = usePlatformOS();

  // handlers
  const handleIssuePeekOverview = (issue: TIssue) => handleRedirection(workspaceSlug, issue, isMobile);

  const issue = issuesMap[issueId];

  const canEditIssueProperties = canEditProperties(issue?.project_id ?? undefined);

  const isDragAllowed = canDragIssuesInCurrentGrouping && !issue?.tempId && canEditIssueProperties;
  const projectIdentifier = getProjectIdentifierById(issue?.project_id);

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issue?.sequence_id,
    isArchived: !!issue?.archived_at,
  });

  useOutsideClickDetector(cardRef, () => {
    cardRef?.current?.classList?.remove(HIGHLIGHT_CLASS);
  });

  // dnd-kit sortable: the whole card is the handle; siblings slide aside as it moves, across columns too
  const {
    ref: sortableRef,
    handleRef,
    isDragSource,
  } = useKanbanSortableCard({
    id: draggableId,
    index,
    columnId,
    issueId,
    disabled: !isDragAllowed,
  });

  if (!issue) return null;

  return (
    <>
      <div
        id={`issue-${issueId}`}
        ref={sortableRef}
        data-dragging={isDragSource || undefined}
        className="group/kanban-block relative mb-2"
        // a card that can't move explains why instead of silently ignoring the press-and-drag
        onPointerDown={(e) => {
          if (isDragAllowed || e.button !== 0 || !issue || issue.tempId) return;
          lockedPointerRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const start = lockedPointerRef.current;
          if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) return;
          lockedPointerRef.current = null;
          setToast({
            type: "warning",
            title: translate("web.cannot_move_work_item"),
            message: !canEditIssueProperties
              ? translate("web.you_are_not_allowed_to_move_this_work_item")
              : translate("web.drag_and_drop_is_disabled_for_the_current_grouping"),
          });
        }}
        onPointerUp={() => {
          lockedPointerRef.current = null;
        }}
      >
        <ControlLink
          id={getIssueBlockId(issueId, groupId, subGroupId)}
          href={workItemLink}
          ref={(element) => {
            cardRef.current = element;
            handleRef(element);
          }}
          className={cn(
            "relative block w-full rounded-xl border border-transparent bg-layer-2 p-2.5 pb-2 text-body-xs-regular shadow-raised-100 outline-[0.5px] outline-transparent transition-[box-shadow,border-color] hover:shadow-raised-200",
            { "hover:cursor-pointer": isDragAllowed },
            // open in peek: no outline; the card lifts, takes a faint accent wash and grows an accent bar on its
            // leading edge, the way a selected row reads in a list
            "before:absolute before:inset-y-4 before:start-0 before:w-[3px] before:scale-y-0 before:rounded-e-full before:bg-accent-primary before:transition-transform before:duration-200 before:ease-[cubic-bezier(0.22,1,0.36,1)]",
            {
              "bg-[color-mix(in_oklab,var(--background-color-accent-primary)_5%,var(--background-color-layer-2))]! shadow-raised-200 before:scale-y-100":
                getIsIssuePeeked(issue.id),
            },
            // lifted while dragged: it grows ~3% with a deeper shadow over ~120ms and trails its motion with a
            // speed-driven lean (eased per frame in KanbanDndProvider); on drop it settles level in ~100ms
            "transition-[box-shadow,border-color,scale,rotate] duration-[200ms,200ms,120ms,100ms] ease-[cubic-bezier(0.2,0,0,1)]",
            {
              "scale-[1.03] rotate-(--kanban-drag-tilt,0deg) cursor-grabbing shadow-raised-300 hover:shadow-raised-300":
                isDragSource,
            }
          )}
          onClick={() => handleIssuePeekOverview(issue)}
          disabled={!!issue?.tempId}
        >
          <div className="space-y-2">
            <KanbanIssueDetailsBlock
              cardRef={cardRef}
              issue={issue}
              displayProperties={displayProperties}
              updateIssue={updateIssue}
              quickActions={quickActions}
              isReadOnly={!canEditIssueProperties}
            />
          </div>
        </ControlLink>
      </div>
    </>
  );
});
