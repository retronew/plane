/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useRef, forwardRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
// plane imports
import { useOutsideClickDetector } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import type { TIssue } from "@plane/types";
import { ControlLink } from "@plane/blocks/layout";
import { StateGroupIcon } from "@plane/blocks/icons";
import { cn, generateWorkItemLink } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// components
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// local components
import { WorkItemPreviewCard } from "../../preview-card";
import type { TRenderQuickActions } from "../list/list-view-types";
import type { CalendarStoreType } from "./base-calendar-root";

type Props = {
  issue: TIssue;
  quickActions: TRenderQuickActions;
  isDragging?: boolean;
};

export const CalendarIssueBlock = observer(
  forwardRef(function CalendarIssueBlock(props: Props, ref: React.ForwardedRef<HTMLAnchorElement>) {
    const { issue, quickActions, isDragging = false } = props;
    // states
    const [isMenuActive, setIsMenuActive] = useState(false);
    // refs
    const blockRef = useRef(null);
    const menuActionRef = useRef<HTMLButtonElement | null>(null);
    // hooks
    const { workspaceSlug } = useParams();
    const { t } = useTranslation();
    const { getProjectStates } = useProjectState();
    const { getIsIssuePeeked } = useIssueDetail();
    const { handleRedirection } = useIssuePeekOverviewRedirection();
    const { isMobile } = usePlatformOS();
    const storeType = useIssueStoreType() as CalendarStoreType;
    const { issuesFilter } = useIssues(storeType);
    const { getProjectIdentifierById } = useProject();

    const stateDetails = getProjectStates(issue?.project_id)?.find((state) => state?.id === issue?.state_id);
    const projectIdentifier = getProjectIdentifierById(issue?.project_id);

    // handlers
    const handleIssuePeekOverview = (peekIssue: TIssue) =>
      handleRedirection(workspaceSlug?.toString(), peekIssue, isMobile);

    useOutsideClickDetector(menuActionRef, () => setIsMenuActive(false));

    const customActionButton = (
      // The quick-action menu grafts its trigger behaviour onto this element (MenuTrigger render),
      // so it has to be a real button.
      <button
        type="button"
        ref={menuActionRef}
        className={`w-full cursor-pointer rounded-sm p-1 text-placeholder hover:bg-layer-1 ${
          isMenuActive ? "bg-layer-1-active text-primary" : "text-secondary"
        }`}
        aria-label={t("aria_labels.common.more_actions")}
        onClick={() => setIsMenuActive(!isMenuActive)}
      >
        <MoreHorizontalOutline className="h-3.5 w-3.5" />
      </button>
    );

    const placement = "bottom-end";

    const workItemLink = generateWorkItemLink({
      workspaceSlug: workspaceSlug?.toString(),
      projectId: issue?.project_id,
      issueId: issue?.id,
      projectIdentifier,
      sequenceId: issue?.sequence_id,
      isArchived: !!issue?.archived_at,
    });

    return (
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={100}
          render={
            <ControlLink
              id={`issue-${issue.id}`}
              href={workItemLink}
              onClick={() => handleIssuePeekOverview(issue)}
              data-calendar-work-item=""
              className="block w-full rounded-xl border border-subtle text-13 text-primary transition-colors hover:border-strong"
              disabled={!!issue?.tempId || isMobile}
              ref={ref}
            >
              <>
                {issue?.tempId !== undefined && (
                  <div className="absolute top-0 left-0 z-[99999] h-full w-full animate-pulse bg-surface-1/20" />
                )}

                <div
                  ref={blockRef}
                  className={cn(
                    "group/calendar-block flex h-10 w-full items-center justify-between gap-1.5 rounded-[11px] px-2 py-1.5 transition-colors md:h-8",
                    {
                      "border-accent-strong bg-surface-2 shadow-raised-200": isDragging,
                      "bg-surface-1 hover:bg-surface-2": !isDragging,
                      "border border-accent-strong hover:border-accent-strong": getIsIssuePeeked(issue.id),
                    }
                  )}
                >
                  <div className="flex h-full items-center gap-1.5 truncate">
                    <StateGroupIcon
                      stateGroup={stateDetails?.group ?? "backlog"}
                      color={stateDetails?.color}
                      icon={stateDetails?.icon}
                      className="size-3.5 shrink-0"
                    />
                    {issue.project_id && (
                      <IssueIdentifier
                        issueId={issue.id}
                        projectId={issue.project_id}
                        size="xs"
                        variant="tertiary"
                        displayProperties={issuesFilter?.issueFilters?.displayProperties}
                      />
                    )}
                    <div className="truncate text-13 font-medium md:text-12">{issue.name}</div>
                  </div>
                  {/* Wrapper exists only to stop clicks reaching the ControlLink; the
                      quick-action menu inside carries its own interactive semantics. */}
                  <div
                    role="presentation"
                    className={cn("size-5 flex-shrink-0 has-[[data-popup-open]]:opacity-100", {
                      "opacity-0 group-focus-within/calendar-block:opacity-100 group-hover/calendar-block:opacity-100":
                        !isMobile && !isMenuActive,
                    })}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {quickActions({
                      issue,
                      parentRef: blockRef,
                      customActionButton,
                      placement,
                    })}
                  </div>
                </div>
              </>
            </ControlLink>
          }
        />
        <PopoverContent side="bottom" align="start" sideOffset={8}>
          {issue.project_id && (
            <WorkItemPreviewCard
              projectId={issue.project_id}
              stateDetails={{
                id: issue.state_id ?? undefined,
              }}
              workItem={issue}
            />
          )}
        </PopoverContent>
      </Popover>
    );
  })
);

CalendarIssueBlock.displayName = "CalendarIssueBlock";
