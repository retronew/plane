import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { CloseOutline, DeleteOutline, EditOutline, LinkOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
// plane imports
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssue, TIssueServiceType, TSubIssueOperations } from "@plane/types";
import { EIssueServiceType, EIssuesStoreType } from "@plane/types";
import { ControlLink } from "@plane/blocks/layout";
import { generateWorkItemLink } from "@plane/utils";
// helpers
import { WithDisplayPropertiesHOC } from "@/components/issues/issue-layouts/properties/with-display-properties-HOC";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// components
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { IssueTreeLines } from "@/components/issues/issue-layouts/list/tree-lines";
// local components
import { SubIssuesListItemProperties } from "./properties";
import { SubIssuesListRoot } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  parentIssueId: string;
  rootIssueId: string;
  treeBranches: boolean[];
  canEdit: boolean;
  handleIssueCrudState: (
    key: "create" | "existing" | "update" | "delete",
    issueId: string,
    issue?: TIssue | null
  ) => void;
  subIssueOperations: TSubIssueOperations;
  issueId: string;
  issueServiceType?: TIssueServiceType;
  storeType?: EIssuesStoreType;
};

type TSubIssuesListItemMenuProps = {
  canEdit: boolean;
  handleIssueCrudState: Props["handleIssueCrudState"];
  issue: TIssue;
  issueServiceType: TIssueServiceType;
  parentIssueId: string;
  subIssueOperations: TSubIssueOperations;
  toggleCreateIssueModal: (value: boolean) => void;
  toggleDeleteIssueModal: (issueId: string | null) => void;
  workItemLink: string;
  workspaceSlug: string;
};

function SubIssuesListItemMenu(props: TSubIssuesListItemMenuProps) {
  const {
    canEdit,
    handleIssueCrudState,
    issue,
    issueServiceType,
    parentIssueId,
    subIssueOperations,
    toggleCreateIssueModal,
    toggleDeleteIssueModal,
    workItemLink,
    workspaceSlug,
  } = props;
  const { t } = useTranslation();

  return (
    <div
      role="presentation"
      className="flex-shrink-0 text-13"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
      }}
    >
      <Menu>
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
        <MenuContent side="bottom" align="end">
          {canEdit && (
            <MenuItem
              icon={<Icon icon={EditOutline} />}
              label={t("issue.edit")}
              onClick={() => {
                handleIssueCrudState("update", parentIssueId, { ...issue });
                toggleCreateIssueModal(true);
              }}
            />
          )}
          <MenuItem
            icon={<Icon icon={LinkOutline} />}
            label={t("issue.copy_link")}
            onClick={() => {
              subIssueOperations.copyLink(workItemLink);
            }}
          />
          {canEdit && (
            <MenuItem
              icon={<Icon icon={CloseOutline} />}
              label={
                issueServiceType === EIssueServiceType.ISSUES ? t("issue.remove.parent.label") : t("issue.remove.label")
              }
              onClick={() => {
                if (issue.project_id)
                  subIssueOperations.removeSubIssue(workspaceSlug, issue.project_id, parentIssueId, issue.id);
              }}
            />
          )}
          {canEdit && (
            <MenuItem
              icon={<Icon icon={DeleteOutline} />}
              label={t("issue.delete.label")}
              onClick={() => {
                handleIssueCrudState("delete", parentIssueId, issue);
                toggleDeleteIssueModal(issue.id);
              }}
            />
          )}
        </MenuContent>
      </Menu>
    </div>
  );
}

type TSubIssuesListItemChildrenProps = {
  canEdit: boolean;
  handleIssueCrudState: Props["handleIssueCrudState"];
  issueId: string;
  issueServiceType: TIssueServiceType;
  projectId: string | null;
  rootIssueId: string;
  treeBranches: boolean[];
  storeType: EIssuesStoreType;
  subIssueCount: number;
  subIssueOperations: TSubIssueOperations;
  workspaceSlug: string;
};

function SubIssuesListItemChildren(props: TSubIssuesListItemChildrenProps) {
  const {
    canEdit,
    handleIssueCrudState,
    issueId,
    issueServiceType,
    projectId,
    rootIssueId,
    treeBranches,
    storeType,
    subIssueCount,
    subIssueOperations,
    workspaceSlug,
  } = props;

  if (!projectId || subIssueCount <= 0 || issueId === rootIssueId) return null;

  return (
    <SubIssuesListRoot
      issueServiceType={issueServiceType}
      storeType={storeType}
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      parentIssueId={issueId}
      rootIssueId={rootIssueId}
      treeBranches={treeBranches}
      canEdit={canEdit}
      handleIssueCrudState={handleIssueCrudState}
      subIssueOperations={subIssueOperations}
    />
  );
}

export const SubIssuesListItem = observer(function SubIssuesListItem(props: Props) {
  const {
    workspaceSlug,
    parentIssueId,
    rootIssueId,
    issueId,
    treeBranches,
    canEdit,
    handleIssueCrudState,
    subIssueOperations,
    issueServiceType = EIssueServiceType.ISSUES,
    storeType = EIssuesStoreType.PROJECT,
  } = props;
  const {
    issue: { getIssueById },
    subIssues: {
      filters: { getSubIssueFilters, getVisibleSubWorkItemIds },
    },
  } = useIssueDetail(issueServiceType);
  const { toggleCreateIssueModal, toggleDeleteIssueModal } = useIssueDetail(issueServiceType);
  const project = useProject();
  const { handleRedirection } = useIssuePeekOverviewRedirection();
  const { isMobile } = usePlatformOS();
  const issue = getIssueById(issueId);

  if (!issue) return <></>;

  // derived values
  const projectDetail = project.getProjectById(issue.project_id);
  const subIssueCount = getVisibleSubWorkItemIds(issueId, rootIssueId).length;
  const subIssueFilters = getSubIssueFilters(rootIssueId);
  const displayProperties = subIssueFilters?.displayProperties ?? {};
  // check if current issue is the root issue
  const isCurrentIssueRoot = issueId === rootIssueId;

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issue.project_id,
    issueId: issue.id,
    projectIdentifier: projectDetail?.identifier,
    sequenceId: issue.sequence_id,
  });

  const handleIssuePeekOverview = (targetIssue: TIssue) => handleRedirection(workspaceSlug, targetIssue, isMobile);

  return (
    <div key={issueId}>
      <ControlLink
        id={`issue-${issue.id}`}
        href={workItemLink}
        onClick={() => handleIssuePeekOverview(issue)}
        className="w-full cursor-pointer"
      >
        <div className="group relative flex min-h-10 w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-sm py-1.5 hover:bg-surface-2">
          <IssueTreeLines
            branches={treeBranches}
            hasChildren={subIssueCount > 0 && !isCurrentIssueRoot}
            variant="dashed"
          />
          <div className="flex min-w-32 flex-1 cursor-pointer items-center gap-2 overflow-hidden">
            <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="priority">
              <div
                role="presentation"
                className="shrink-0"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                }}
              >
                <PrioritySelect
                  value={issue.priority}
                  onChange={(priority) =>
                    issue.project_id &&
                    subIssueOperations.updateSubIssue(workspaceSlug, issue.project_id, parentIssueId, issueId, {
                      priority,
                    })
                  }
                  disabled={!canEdit}
                  variant="icon-sm"
                  tooltip
                />
              </div>
            </WithDisplayPropertiesHOC>
            <WithDisplayPropertiesHOC displayProperties={displayProperties || {}} displayPropertyKey="key">
              <div className="flex-shrink-0">
                {projectDetail && (
                  <span className="text-caption-sm-regular font-medium whitespace-nowrap text-secondary">
                    {projectDetail.identifier}-{issue.sequence_id}
                  </span>
                )}
              </div>
            </WithDisplayPropertiesHOC>
            <Tooltip label={issue.name} layout="stacked" align="start" disabled={isMobile}>
              <span className="w-0 flex-1 truncate text-13 text-primary">{issue.name}</span>
            </Tooltip>
          </div>

          <div
            role="presentation"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.stopPropagation();
            }}
            className="flex-shrink-0 text-13"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <SubIssuesListItemProperties
              workspaceSlug={workspaceSlug}
              parentIssueId={parentIssueId}
              issueId={issueId}
              canEdit={canEdit}
              updateSubIssue={subIssueOperations.updateSubIssue}
              displayProperties={displayProperties}
              issue={issue}
            />
          </div>

          {/* The row's ControlLink activates on click and on Enter/Space, so the menu's own
              activation must not reach it. */}
          <SubIssuesListItemMenu
            canEdit={canEdit}
            handleIssueCrudState={handleIssueCrudState}
            issue={issue}
            issueServiceType={issueServiceType}
            parentIssueId={parentIssueId}
            subIssueOperations={subIssueOperations}
            toggleCreateIssueModal={toggleCreateIssueModal}
            toggleDeleteIssueModal={toggleDeleteIssueModal}
            workItemLink={workItemLink}
            workspaceSlug={workspaceSlug}
          />
        </div>
      </ControlLink>

      {/* should not expand the current issue if it is also the root issue*/}
      <SubIssuesListItemChildren
        canEdit={canEdit}
        handleIssueCrudState={handleIssueCrudState}
        issueId={issue.id}
        issueServiceType={issueServiceType}
        projectId={issue.project_id}
        rootIssueId={rootIssueId}
        treeBranches={treeBranches}
        storeType={storeType}
        subIssueCount={subIssueCount}
        subIssueOperations={subIssueOperations}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
});
