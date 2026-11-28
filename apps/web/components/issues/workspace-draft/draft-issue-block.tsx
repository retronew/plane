/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";

import React, { useRef, useState } from "react";
import { omit } from "lodash-es";
import { observer } from "mobx-react";
import { CopyOutline, DeleteOutline, EditOutline, SquareStackOutline } from "@makeplane/propel/icons";
// plane utils
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TIssuePriorities, TWorkspaceDraftIssue } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { Row } from "@plane/blocks/layout";
import { cn } from "@plane/utils";
// components
import { PrioritySelect } from "@/components/dropdowns/priority/priority-select";
import { StateSelect } from "@/components/dropdowns/state/state-select";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspaceDraftIssues } from "@/hooks/store/workspace-draft";
// local imports
import { IdentifierText } from "../issue-detail/identifier-text";
import { CreateUpdateIssueModal } from "../issue-modal/modal";
import { WorkspaceDraftIssueDeleteIssueModal } from "./delete-modal";
import { DraftIssueProperties } from "./draft-issue-properties";
import { WorkspaceDraftIssueQuickActions } from "./quick-action";

type Props = {
  workspaceSlug: string;
  issueId: string;
};

const stopRowEvent = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};

export const DraftIssueBlock = observer(function DraftIssueBlock(props: Props) {
  // props
  const { workspaceSlug, issueId } = props;
  // states
  const [moveToIssue, setMoveToIssue] = useState(false);
  const [createUpdateIssueModal, setCreateUpdateIssueModal] = useState(false);
  const [issueToEdit, setIssueToEdit] = useState<TWorkspaceDraftIssue | undefined>(undefined);
  const [deleteIssueModal, setDeleteIssueModal] = useState(false);
  // hooks
  const { getIssueById, updateIssue, deleteIssue } = useWorkspaceDraftIssues();
  const { sidebarCollapsed: isSidebarCollapsed } = useAppTheme();
  const { getProjectIdentifierById } = useProject();
  // ref
  const issueRef = useRef<HTMLDivElement | null>(null);
  // derived values
  const issue = getIssueById(issueId);
  const projectIdentifier = (issue && issue.project_id && getProjectIdentifierById(issue.project_id)) || undefined;
  if (!issue || !projectIdentifier) return null;

  const openEditor = () => {
    setMoveToIssue(false);
    setIssueToEdit(issue);
    setCreateUpdateIssueModal(true);
  };

  const duplicateIssuePayload = omit(
    {
      ...issue,
      name: translate("web.runtime.copy_name", { name: issue.name }),
      is_draft: true,
    },
    ["id"]
  );

  const MENU_ITEMS: TContextMenuItem[] = [
    {
      key: "edit",
      title: "edit",
      icon: EditOutline,
      action: openEditor,
    },
    {
      key: "make-a-copy",
      title: "make_a_copy",
      icon: CopyOutline,
      action: () => {
        setMoveToIssue(false);
        setIssueToEdit(undefined);
        setCreateUpdateIssueModal(true);
      },
    },
    {
      key: "move-to-issues",
      title: "move_to_project",
      icon: SquareStackOutline,
      action: () => {
        setMoveToIssue(true);
        setIssueToEdit(issue);
        setCreateUpdateIssueModal(true);
      },
    },
    {
      key: "delete",
      variant: "danger",
      title: "delete",
      icon: DeleteOutline,
      action: () => {
        setDeleteIssueModal(true);
      },
    },
  ];

  const handlePriorityChange = (priority: TIssuePriorities) => {
    if (!issue.project_id) return;
    void updateIssue(workspaceSlug, issue.id, { priority });
  };

  const handleStateChange = (stateId: string) => {
    if (!issue.project_id) return;
    void updateIssue(workspaceSlug, issue.id, { state_id: stateId });
  };

  return (
    <>
      <WorkspaceDraftIssueDeleteIssueModal
        data={issue}
        isOpen={deleteIssueModal}
        handleClose={() => setDeleteIssueModal(false)}
        onSubmit={async () => deleteIssue(workspaceSlug, issueId)}
      />
      <CreateUpdateIssueModal
        isOpen={createUpdateIssueModal}
        onClose={() => {
          setCreateUpdateIssueModal(false);
          setIssueToEdit(undefined);
          setMoveToIssue(false);
        }}
        data={issueToEdit ?? duplicateIssuePayload}
        onSubmit={async (data) => {
          if (issueToEdit) await updateIssue(workspaceSlug, issueId, data);
        }}
        storeType={EIssuesStoreType.WORKSPACE_DRAFT}
        fetchIssueDetails={false}
        moveToIssue={moveToIssue}
        isDraft
      />
      {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events jsx_a11y/no-static-element-interactions */}
      <div
        id={`issue-${issue.id}`}
        data-draft-issue-row=""
        className="relative w-full cursor-pointer border-b border-b-subtle-1"
        onClick={openEditor}
      >
        <Row
          ref={issueRef}
          className={cn(
            "group/list-block relative flex min-h-11 flex-col gap-2 bg-layer-transparent py-1 text-13 transition-colors hover:bg-layer-transparent-hover",
            {
              "md:flex-row md:items-center": isSidebarCollapsed,
              "lg:flex-row lg:items-center": !isSidebarCollapsed,
            }
          )}
        >
          <div className="flex w-full min-w-0 items-center justify-between gap-2 self-stretch">
            <div className="relative flex min-h-9 min-w-0 flex-grow items-center gap-2">
              {/* Left inline controls aligned with IssueBlockLeft: Priority -> Identifier -> State */}
              {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events jsx_a11y/no-static-element-interactions */}
              <div className="flex shrink-0 items-center gap-2" onClick={stopRowEvent}>
                <PrioritySelect
                  value={issue.priority}
                  variant="icon-sm"
                  className="h-9 w-4 min-w-4 rounded-sm p-0"
                  tooltip
                  onChange={handlePriorityChange}
                />
                {issue.project_id && (
                  <div className="flex shrink-0 items-center">
                    <IdentifierText
                      identifier={projectIdentifier}
                      enableClickToCopyIdentifier
                      size="xs"
                      variant="tertiary"
                    />
                  </div>
                )}
                <StateSelect
                  issueTypeId={issue.type_id}
                  isForWorkItemCreation
                  value={issue.state_id}
                  projectId={issue.project_id ?? undefined}
                  variant="icon-sm"
                  className="h-9 w-4 min-w-4 rounded-sm p-0"
                  tooltip
                  onChange={handleStateChange}
                />
              </div>

              <Tooltip label={issue.name} layout="stacked" align="start">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditor();
                  }}
                  className="min-w-0 flex-1 cursor-pointer truncate text-left text-body-xs-medium text-primary outline-none focus-visible:underline"
                >
                  {issue.name}
                </button>
              </Tooltip>
            </div>

            {/* mobile quick actions */}
            {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events jsx_a11y/no-static-element-interactions */}
            <div
              className={cn("block shrink-0", {
                "md:hidden": isSidebarCollapsed,
                "lg:hidden": !isSidebarCollapsed,
              })}
              onClick={stopRowEvent}
            >
              <WorkspaceDraftIssueQuickActions parentRef={issueRef} MENU_ITEMS={MENU_ITEMS} />
            </div>
          </div>

          {/* oxlint-disable-next-line jsx_a11y/click-events-have-key-events jsx_a11y/no-static-element-interactions */}
          <div className="flex flex-shrink-0 items-center gap-2" onClick={stopRowEvent}>
            <DraftIssueProperties
              className={`relative flex flex-wrap ${isSidebarCollapsed ? "md:flex-shrink-0 md:flex-grow" : "lg:flex-shrink-0 lg:flex-grow"} items-center gap-2 whitespace-nowrap`}
              issue={issue}
              hideInlineLeftProperties
              updateIssue={async (_projectId, draftIssueId, data) => {
                await updateIssue(workspaceSlug, draftIssueId, data);
              }}
            />
            <div
              className={cn(
                "hidden opacity-0 transition-opacity group-focus-within/list-block:opacity-100 group-hover/list-block:opacity-100 has-[[data-popup-open]]:opacity-100",
                {
                  "md:flex": isSidebarCollapsed,
                  "lg:flex": !isSidebarCollapsed,
                }
              )}
              role="presentation"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <WorkspaceDraftIssueQuickActions parentRef={issueRef} MENU_ITEMS={MENU_ITEMS} />
            </div>
          </div>
        </Row>
      </div>
    </>
  );
});
