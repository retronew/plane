// oxlint-disable no-shadow
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import { EFileAssetType } from "@plane/types";
import { getDate } from "@plane/utils";
import type { TNameDescriptionLoader } from "@plane/types";
// components
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
// plane web components
import { IssueTypeSwitcher } from "@/components/issues/issue-type-switcher";
import { WorkflowApprovalCard } from "@/components/workflow/approval-card";
// plane web hooks
// services
import { WorkItemVersionService } from "@/services/issue";
// local components
import type { TIssueOperations } from "../issue-detail";
import { IssueParentDetail } from "../issue-detail/parent";
import { IssueReaction } from "../issue-detail/reactions";
import { IssueTitleInput } from "../title-input";
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  editorRef: React.RefObject<EditorRefApi | null>;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled: boolean;
  embedIssue?: boolean;
  isArchived: boolean;
  isSubmitting: TNameDescriptionLoader;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
};

function PeekDescriptionVersions({
  workspaceSlug,
  projectId,
  issueId,
  createdAt,
  createdByDisplayName,
  isArchived,
  editorRef,
  className,
}: {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  createdAt: Date;
  createdByDisplayName: string;
  isArchived: boolean;
  editorRef: Props["editorRef"];
  className?: string;
}) {
  return (
    <DescriptionVersionsRoot
      className={className}
      entityInformation={{
        createdAt,
        createdByDisplayName: createdByDisplayName,
        id: issueId,
        isRestoreDisabled: isArchived,
      }}
      fetchHandlers={{
        listDescriptionVersions: (issueId) =>
          workItemVersionService.listDescriptionVersions(workspaceSlug, projectId, issueId),
        retrieveDescriptionVersion: (issueId, versionId) =>
          workItemVersionService.retrieveDescriptionVersion(workspaceSlug, projectId, issueId, versionId),
      }}
      handleRestore={(descriptionHTML) => editorRef.current?.setEditorValue(descriptionHTML, true)}
      projectId={projectId}
      workspaceSlug={workspaceSlug}
    />
  );
}

export const PeekOverviewIssueDetails = observer(function PeekOverviewIssueDetails(props: Props) {
  const {
    editorRef,
    workspaceSlug,
    issueId,
    issueOperations,
    disabled,
    isArchived,
    isSubmitting,
    setIsSubmitting,
    embedIssue = false,
  } = props;
  // store hooks
  const { data: currentUser } = useUser();
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const { getUserDetails } = useMember();
  // reload confirmation
  const { setShowAlert } = useReloadConfirmations(isSubmitting === "submitting");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isSubmitting === "submitted") {
      setShowAlert(false);
      timer = setTimeout(() => setIsSubmitting("saved"), 2000);
    } else if (isSubmitting === "submitting") {
      setShowAlert(true);
    }
    return () => clearTimeout(timer);
  }, [isSubmitting, setShowAlert, setIsSubmitting]);

  // derived values
  const issue = getIssueById(issueId);

  if (!issue || !issue.project_id) return <></>;

  const issueProjectId = issue.project_id;
  const issueDescription = issue.description_html || "<p></p>";
  const readOnly = disabled || isArchived;
  const createdAt = getDate(issue.created_at);

  return (
    <div className={embedIssue ? "space-y-4 pb-4" : "space-y-2"}>
      {issue.parent_id && (
        <IssueParentDetail
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issueId}
          issue={issue}
          issueOperations={issueOperations}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <IssueTypeSwitcher issueId={issueId} disabled={readOnly} />
      </div>
      <IssueTitleInput
        workspaceSlug={workspaceSlug}
        projectId={issue.project_id}
        issueId={issue.id}
        isSubmitting={isSubmitting}
        setIsSubmitting={(value) => setIsSubmitting(value)}
        issueOperations={issueOperations}
        disabled={readOnly}
        value={issue.name}
      />

      <WorkflowApprovalCard
        workspaceSlug={workspaceSlug}
        projectId={issue.project_id}
        issueId={issueId}
        disabled={readOnly}
      />

      <DescriptionInput
        issueSequenceId={issue.sequence_id}
        containerClassName="-ml-3 border-none"
        disabled={readOnly}
        editorRef={editorRef}
        entityId={issue.id}
        fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
        initialValue={issueDescription}
        key={issue.id}
        onSubmit={async (value, isMigrationUpdate) => {
          await issueOperations.update(workspaceSlug, issueProjectId, issue.id, {
            description_html: value.description_html,
            ...(isMigrationUpdate ? { skip_activity: "true" } : {}),
          });
        }}
        setIsSubmitting={(value) => setIsSubmitting(value)}
        projectId={issue.project_id}
        workspaceSlug={workspaceSlug}
      />

      <div className="flex items-center justify-between gap-2">
        {currentUser && (
          <IssueReaction
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            issueId={issueId}
            currentUser={currentUser}
            disabled={isArchived}
            className={embedIssue ? "mt-0 flex items-center" : undefined}
          />
        )}
        {!disabled && createdAt && (
          <PeekDescriptionVersions
            className={embedIssue ? "ml-auto flex-shrink-0" : "flex-shrink-0"}
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            issueId={issueId}
            createdAt={createdAt}
            createdByDisplayName={getUserDetails(issue.created_by ?? "")?.display_name ?? ""}
            isArchived={isArchived}
            editorRef={editorRef}
          />
        )}
      </div>
    </div>
  );
});
