// oxlint-disable no-shadow
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { observer } from "mobx-react";
import { AiStar1Outline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { GptAssistantPopover } from "@/components/core/modals/gpt-assistant-popover";
import { useInstance } from "@/hooks/store/use-instance";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TIssue, TNameDescriptionLoader } from "@plane/types";
import { EFileAssetType, EIssueServiceType } from "@plane/types";
// components
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
import { IssueTypeSwitcher } from "@/components/issues/issue-type-switcher";
import { WorkflowApprovalCard } from "@/components/workflow/approval-card";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import useSize from "@/hooks/use-window-size";
// services
import { WorkItemVersionService } from "@/services/issue";
// local imports
import { IssueDetailWidgets } from "../issue-detail-widgets";
import { NameDescriptionUpdateStatus } from "../issue-update-status";
import { PeekOverviewProperties } from "../peek-overview/properties";
import { IssueTitleInput } from "../title-input";
import { IssueActivity } from "./issue-activity";
import { IssueParentDetail } from "./parent";
import { IssueReaction } from "./reactions";
import type { TIssueOperations } from "./root";
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
  isArchived: boolean;
};

type TIssueContentHeaderProps = {
  issueId: string;
  isDisabled: boolean;
  isSubmitting: TNameDescriptionLoader;
};

function IssueContentHeader({ issueId, isDisabled, isSubmitting }: TIssueContentHeaderProps) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-4">
      <IssueTypeSwitcher issueId={issueId} disabled={isDisabled} />
      <div className="flex items-center gap-3">
        <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}

type TIssueDescriptionSectionProps = {
  workspaceSlug: string;
  projectId: string;
  issue: TIssue;
  issueOperations: TIssueOperations;
  isDisabled: boolean;
  editorRef: RefObject<EditorRefApi | null>;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
};

function IssueDescriptionSection({
  workspaceSlug,
  projectId,
  issue,
  issueOperations,
  isDisabled,
  editorRef,
  setIsSubmitting,
}: TIssueDescriptionSectionProps) {
  return (
    <DescriptionInput
      issueSequenceId={issue.sequence_id}
      containerClassName="-ml-6 border-none p-0! pl-6!"
      disabled={isDisabled}
      editorRef={editorRef}
      entityId={issue.id}
      fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
      initialValue={issue.description_html}
      key={issue.id}
      onSubmit={async (value, isMigrationUpdate) => {
        if (!issue.id || !projectId) return;
        await issueOperations.update(workspaceSlug, projectId, issue.id, {
          description_html: value.description_html,
          ...(isMigrationUpdate ? { skip_activity: "true" } : {}),
        });
      }}
      projectId={projectId}
      setIsSubmitting={setIsSubmitting}
      workspaceSlug={workspaceSlug}
    />
  );
}

type TIssueAIAssistantProps = {
  workspaceSlug: string;
  issue: TIssue;
  isDisabled: boolean;
  editorRef: RefObject<EditorRefApi | null>;
};

const IssueAIAssistant = observer(function IssueAIAssistant({
  workspaceSlug,
  issue,
  isDisabled,
  editorRef,
}: TIssueAIAssistantProps) {
  // states
  const [aiOpen, setAiOpen] = useState(false);
  // store hooks
  const { config: instanceConfig } = useInstance();
  const { t } = useTranslation();
  const { getWorkspaceBySlug } = useWorkspace();

  if (isDisabled) return null;
  if (!instanceConfig?.has_llm_configured) return null;
  if (getWorkspaceBySlug(workspaceSlug)?.ai_enabled === false) return null;

  return (
    <div className="flex justify-end">
      <GptAssistantPopover
        key={issue.id}
        isOpen={aiOpen}
        handleClose={() => setAiOpen(false)}
        workspaceSlug={workspaceSlug}
        getContext={() => ({
          kind: "issue",
          title: issue.name,
          document: editorRef.current?.getDocument().html ?? "",
        })}
        onApply={(html, mode, context) => {
          const editor = editorRef.current;
          if (!editor || context.title !== issue.name || context.document !== editor.getDocument().html) return false;
          editor.setEditorValue(mode === "replace" ? html : context.document + html, true);
          return true;
        }}
        onUndo={(context) => editorRef.current?.setEditorValue(context.document, true)}
        button={
          <button
            type="button"
            className="flex items-center gap-1 rounded-sm px-2 py-1 text-13 hover:bg-layer-1"
            onClick={() => setAiOpen(true)}
          >
            <AiStar1Outline className="size-4" />
            {t("web.ai_writing_title")}
          </button>
        }
      />
    </div>
  );
});

type TIssueMainContentFooterProps = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issue: TIssue;
  isEditable: boolean;
  isArchived: boolean;
  isDisabled: boolean;
  editorRef: RefObject<EditorRefApi | null>;
};

const IssueMainContentFooter = observer(function IssueMainContentFooter({
  workspaceSlug,
  projectId,
  issueId,
  issue,
  isEditable,
  isArchived,
  isDisabled,
  editorRef,
}: TIssueMainContentFooterProps) {
  const { data: currentUser } = useUser();
  const { getUserDetails } = useMember();

  return (
    <div className="flex items-center justify-between gap-2">
      {currentUser && (
        <IssueReaction
          className="flex-shrink-0"
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          currentUser={currentUser}
          disabled={isArchived}
        />
      )}
      {isEditable && (
        <DescriptionVersionsRoot
          className="flex-shrink-0"
          entityInformation={{
            createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
            createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
            id: issueId,
            isRestoreDisabled: isDisabled,
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
      )}
    </div>
  );
});

export const IssueMainContent = observer(function IssueMainContent(props: Props) {
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable, isArchived } = props;
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  // states
  const [isSubmitting, setIsSubmitting] = useState<TNameDescriptionLoader>("saved");
  // hooks
  const windowSize = useSize();
  const {
    issue: { getIssueById },
    peekIssue,
  } = useIssueDetail();
  const { setShowAlert } = useReloadConfirmations(isSubmitting === "submitting");
  // derived values
  const issue = issueId ? getIssueById(issueId) : undefined;
  const isDisabled = isArchived || !isEditable;
  const isPeekModeActive = Boolean(peekIssue);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isSubmitting === "submitted") {
      setShowAlert(false);
      timer = setTimeout(() => setIsSubmitting("saved"), 2000);
    } else if (isSubmitting === "submitting") setShowAlert(true);
    return () => clearTimeout(timer);
  }, [isSubmitting, setShowAlert, setIsSubmitting]);

  if (!issue?.project_id) return <></>;

  return (
    <>
      <div className="space-y-4 rounded-lg">
        {issue.parent_id && (
          <IssueParentDetail
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            issue={issue}
            issueOperations={issueOperations}
          />
        )}

        <IssueContentHeader issueId={issueId} isDisabled={isDisabled} isSubmitting={isSubmitting} />

        <IssueTitleInput
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issue.id}
          isSubmitting={isSubmitting}
          setIsSubmitting={(value) => setIsSubmitting(value)}
          issueOperations={issueOperations}
          disabled={isDisabled}
          value={issue.name}
        />

        <WorkflowApprovalCard
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issueId}
          disabled={isDisabled}
        />

        <IssueDescriptionSection
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issue={issue}
          issueOperations={issueOperations}
          isDisabled={isDisabled}
          editorRef={editorRef}
          setIsSubmitting={setIsSubmitting}
        />

        <IssueAIAssistant workspaceSlug={workspaceSlug} issue={issue} isDisabled={isDisabled} editorRef={editorRef} />

        <IssueMainContentFooter
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issue={issue}
          isEditable={isEditable}
          isArchived={isArchived}
          isDisabled={isDisabled}
          editorRef={editorRef}
        />
      </div>

      <IssueDetailWidgets
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
        disabled={isDisabled}
        renderWidgetModals={!isPeekModeActive}
        issueServiceType={EIssueServiceType.ISSUES}
      />

      {windowSize[0] < 768 && (
        <PeekOverviewProperties
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={isDisabled}
        />
      )}

      <IssueActivity workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={isArchived} />
    </>
  );
});
