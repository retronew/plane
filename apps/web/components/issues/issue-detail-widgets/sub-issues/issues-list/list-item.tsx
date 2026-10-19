import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import {
  ChevronRightOutline,
  CloseOutline,
  DeleteOutline,
  EditOutline,
  LinkOutline,
  MoreHorizontalOutline,
} from "@makeplane/propel/icons";
// plane imports
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssue, TIssueServiceType, TSubIssueOperations } from "@plane/types";
import { EIssueServiceType, EIssuesStoreType } from "@plane/types";
import { ControlLink } from "@plane/blocks/layout";
import { cn, generateWorkItemLink } from "@plane/utils";
// helpers
import { useSubIssueOperations } from "@/components/issues/issue-detail-widgets/sub-issues/helper";
import { WithDisplayPropertiesHOC } from "@/components/issues/issue-layouts/properties/with-display-properties-HOC";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
// components
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// local components
import { SubIssuesListItemProperties } from "./properties";
import { SubIssuesListRoot } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  parentIssueId: string;
  rootIssueId: string;
  spacingLeft: number;
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

type TSubIssuesListItemToggleProps = {
  ariaLabel: string;
  isCurrentIssueRoot: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => Promise<void> | void;
  subIssueCount: number;
};

function SubIssuesListItemToggle(props: TSubIssuesListItemToggleProps) {
  const { ariaLabel, isCurrentIssueRoot, isExpanded, isLoading, onToggle, subIssueCount } = props;

  if (subIssueCount <= 0 || isCurrentIssueRoot) return null;

  if (isLoading)
    return (
      <div className="flex h-full w-full cursor-not-allowed items-center justify-center rounded-xs bg-layer-1 transition-all">
        <LinkOutline width={14} height={14} className="animate-spin" />
      </div>
    );

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="flex h-full w-full cursor-pointer items-center justify-center text-placeholder hover:text-tertiary"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onToggle();
      }}
    >
      <ChevronRightOutline
        className={cn("size-3.5 transition-all", {
          "rotate-90": isExpanded,
        })}
      />
    </button>
  );
}

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
  isCurrentIssueRoot: boolean;
  isExpanded: boolean;
  issueId: string;
  projectId: string | null;
  rootIssueId: string;
  spacingLeft: number;
  storeType: EIssuesStoreType;
  subIssueCount: number;
  subIssueOperations: TSubIssueOperations;
  workspaceSlug: string;
};

function SubIssuesListItemChildren(props: TSubIssuesListItemChildrenProps) {
  const {
    canEdit,
    handleIssueCrudState,
    isCurrentIssueRoot,
    isExpanded,
    issueId,
    projectId,
    rootIssueId,
    spacingLeft,
    storeType,
    subIssueCount,
    subIssueOperations,
    workspaceSlug,
  } = props;

  if (!isExpanded || !projectId || subIssueCount <= 0 || isCurrentIssueRoot) return null;

  return (
    <SubIssuesListRoot
      storeType={storeType}
      workspaceSlug={workspaceSlug}
      projectId={projectId}
      parentIssueId={issueId}
      rootIssueId={rootIssueId}
      spacingLeft={spacingLeft + 22}
      canEdit={canEdit}
      handleIssueCrudState={handleIssueCrudState}
      subIssueOperations={subIssueOperations}
    />
  );
}

export const SubIssuesListItem = observer(function SubIssuesListItem(props: Props) {
  const {
    workspaceSlug,
    projectId,
    parentIssueId,
    rootIssueId,
    issueId,
    spacingLeft = 10,
    canEdit,
    handleIssueCrudState,
    subIssueOperations,
    issueServiceType = EIssueServiceType.ISSUES,
    storeType = EIssuesStoreType.PROJECT,
  } = props;
  const { t } = useTranslation();
  const {
    issue: { getIssueById },
    subIssues: {
      filters: { getSubIssueFilters },
    },
  } = useIssueDetail(issueServiceType);
  const {
    subIssues: { subIssueHelpersByIssueId, setSubIssueHelpers },
  } = useIssueDetail();
  const { fetchSubIssues } = useSubIssueOperations(EIssueServiceType.ISSUES);
  const { toggleCreateIssueModal, toggleDeleteIssueModal } = useIssueDetail(issueServiceType);
  const project = useProject();
  const { handleRedirection } = useIssuePeekOverviewRedirection();
  const { isMobile } = usePlatformOS();
  const issue = getIssueById(issueId);

  if (!issue) return <></>;

  // derived values
  const projectDetail = project.getProjectById(issue.project_id);
  const subIssueHelpers = subIssueHelpersByIssueId(parentIssueId);
  const subIssueCount = issue.sub_issues_count ?? 0;
  const subIssueFilters = getSubIssueFilters(parentIssueId);
  const displayProperties = subIssueFilters?.displayProperties ?? {};
  // check if current issue is the root issue
  const isCurrentIssueRoot = issueId === rootIssueId;
  const isExpanded = subIssueHelpers.issue_visibility.includes(issue.id);
  const isPreviewLoading = subIssueHelpers.preview_loader.includes(issue.id);

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
        <div
          className="group relative flex h-full min-h-11 w-full items-center py-1 pr-2 transition-all hover:bg-surface-2"
          style={{ paddingLeft: `${spacingLeft}px` }}
        >
          <div className="flex size-5 flex-shrink-0 items-center justify-center">
            {/* disable the chevron when current issue is also the root issue*/}
            <SubIssuesListItemToggle
              ariaLabel={t("web.toggle_sub_issues")}
              isCurrentIssueRoot={isCurrentIssueRoot}
              isExpanded={isExpanded}
              isLoading={isPreviewLoading}
              onToggle={async () => {
                if (!subIssueHelpers.issue_visibility.includes(issueId)) {
                  setSubIssueHelpers(parentIssueId, "preview_loader", issueId);
                  await fetchSubIssues(workspaceSlug, projectId, issueId);
                  setSubIssueHelpers(parentIssueId, "preview_loader", issueId);
                }
                setSubIssueHelpers(parentIssueId, "issue_visibility", issueId);
              }}
              subIssueCount={subIssueCount}
            />
          </div>

          <div className="flex w-full cursor-pointer items-center gap-3 truncate">
            <WithDisplayPropertiesHOC displayProperties={displayProperties || {}} displayPropertyKey="key">
              <div className="flex-shrink-0">
                {projectDetail && (
                  <IssueIdentifier
                    projectId={projectDetail.id}
                    issueTypeId={issue.type_id}
                    projectIdentifier={projectDetail.identifier}
                    issueSequenceId={issue.sequence_id}
                    size="xs"
                    variant="secondary"
                  />
                )}
              </div>
            </WithDisplayPropertiesHOC>
            <Tooltip label={issue.name} layout="stacked" disabled={isMobile}>
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
        isCurrentIssueRoot={isCurrentIssueRoot}
        isExpanded={subIssueHelpers.issue_visibility.includes(issueId)}
        issueId={issue.id}
        projectId={issue.project_id}
        rootIssueId={rootIssueId}
        spacingLeft={spacingLeft}
        storeType={storeType}
        subIssueCount={subIssueCount}
        subIssueOperations={subIssueOperations}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
});
