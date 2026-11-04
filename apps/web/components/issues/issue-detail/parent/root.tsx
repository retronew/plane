import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { MoreHorizontalOutline, ParentOutline, RemoveOutline } from "@makeplane/propel/icons";
import type { TIssue } from "@plane/types";
// component
import { Tooltip } from "@makeplane/propel/components/tooltip";
// ui
import { ControlLink } from "@plane/blocks/layout";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuGroup, MenuItem, MenuLabel, MenuTrigger } from "@makeplane/propel/components/menu";
// helpers
import { generateWorkItemLink } from "@plane/utils";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// types
import type { TIssueOperations } from "../root";
import { IssueParentSiblings } from "./siblings";

export type TIssueParentDetail = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issue: TIssue;
  issueOperations: TIssueOperations;
};

export const IssueParentDetail = observer(function IssueParentDetail(props: TIssueParentDetail) {
  const { workspaceSlug, projectId, issueId, issue, issueOperations } = props;
  // translation
  const { t } = useTranslation();
  // hooks
  const { issueMap } = useIssues();
  const { handleRedirection } = useIssuePeekOverviewRedirection();
  const { isMobile } = usePlatformOS();
  const { getProjectIdentifierById } = useProject();

  // derived values
  const parentIssue = issueMap?.[issue.parent_id || ""] || undefined;
  const projectIdentifier = getProjectIdentifierById(parentIssue?.project_id);

  if (!parentIssue) return <></>;

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: parentIssue?.project_id,
    issueId: parentIssue.id,
    projectIdentifier,
    sequenceId: parentIssue.sequence_id,
  });

  const handleParentIssueClick = () => {
    handleRedirection(workspaceSlug, parentIssue, isMobile);
  };

  return (
    <>
      <div data-parent-issue="" className="flex min-h-8 w-full min-w-0 items-center gap-2 text-caption-md-regular">
        <span className="flex shrink-0 items-center gap-1.5 text-tertiary">
          <ParentOutline className="size-3.5" />
          <span>{t("common.parent")}</span>
        </span>
        <Tooltip label={`${projectIdentifier}-${parentIssue.sequence_id} ${parentIssue.name}`}>
          <ControlLink
            href={workItemLink}
            onClick={handleParentIssueClick}
            className="flex min-w-0 items-center gap-2 rounded-md py-1 text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            <span className="shrink-0 text-tertiary">
              {projectIdentifier}-{parentIssue.sequence_id}
            </span>
            <span className="min-w-0 truncate">{parentIssue.name}</span>
          </ControlLink>
        </Tooltip>

        <Menu>
          {/* Icon-only trigger, so it needs an explicit accessible name. */}
          <MenuTrigger
            render={
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t("aria_labels.common.more_actions")}
                icon={<Icon icon={MoreHorizontalOutline} />}
              />
            }
          />
          <MenuContent side="bottom" align="start">
            <MenuGroup>
              <MenuLabel>{t("issue.sibling.label")}</MenuLabel>
              <IssueParentSiblings workspaceSlug={workspaceSlug} currentIssue={issue} parentIssue={parentIssue} />
            </MenuGroup>
            <MenuItem
              variant="danger"
              icon={<Icon icon={RemoveOutline} />}
              label={t("issue.remove.parent.label")}
              onClick={() => {
                void issueOperations.update(workspaceSlug, projectId, issueId, { parent_id: null });
              }}
            />
          </MenuContent>
        </Menu>
      </div>
    </>
  );
});
