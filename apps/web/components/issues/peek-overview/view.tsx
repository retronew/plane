/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { createPortal } from "react-dom";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TNameDescriptionLoader } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { cn } from "@plane/utils";
import { ContentWrapper } from "@plane/blocks/layout";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import useKeypress from "@/hooks/use-keypress";
import usePeekOverviewOutsideClickDetector from "@/hooks/use-peek-overview-outside-click";
// local imports
import type { TIssueOperations } from "../issue-detail";
import { IssueActivity } from "../issue-detail/issue-activity";
import { IssueDetailWidgets } from "../issue-detail-widgets";
import { IssuePeekOverviewError } from "./error";
import type { TPeekModes } from "./header";
import { IssuePeekOverviewHeader } from "./header";
import { PeekOverviewIssueDetails } from "./issue-detail";
import { IssuePeekOverviewLoader } from "./loader";
import { PeekOverviewProperties } from "./properties";

interface IIssueView {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  isLoading?: boolean;
  isError?: boolean;
  is_archived: boolean;
  disabled?: boolean;
  embedIssue?: boolean;
  embedRemoveCurrentNotification?: () => void;
  issueOperations: TIssueOperations;
}

function isPeekDismissBlocked(...openStates: Array<boolean | undefined>) {
  return openStates.some(Boolean);
}

function handlePeekEscape(
  isAnyModalOpen: boolean,
  editorRef: React.RefObject<EditorRefApi | null>,
  issueId: string,
  removeRoutePeekId: () => void
) {
  const editorImageFullScreenModalElement = document.querySelector(".editor-image-full-screen-modal");
  const dropdownElement = document.activeElement?.tagName === "INPUT";
  const isAnyDropbarOpen = editorRef.current?.isAnyDropbarOpen();
  if (isAnyModalOpen || dropdownElement || isAnyDropbarOpen || editorImageFullScreenModalElement) return;
  removeRoutePeekId();
  document.getElementById(`issue-${issueId}`)?.focus();
}

function getPeekOverviewClassName(embedIssue: boolean, peekMode: TPeekModes) {
  return cn(
    !embedIssue
      ? "absolute z-[25] flex flex-col overflow-hidden rounded-sm border border-subtle bg-surface-1 transition-all duration-300"
      : "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
    !embedIssue && {
      "top-0 right-0 bottom-0 w-full border-0 border-l md:w-[50%]": peekMode === "side-peek",
      "top-[8.33%] left-[8.33%] size-5/6": peekMode === "modal",
      "absolute inset-0 m-4": peekMode === "full-screen",
    }
  );
}

type TPeekContentProps = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: IIssueView["issueOperations"];
  disabled?: boolean;
  is_archived: boolean;
  editorRef: React.RefObject<EditorRefApi | null>;
  isSubmitting: TNameDescriptionLoader;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
};

function PeekEmbeddedContent({
  workspaceSlug,
  projectId,
  issueId,
  issueOperations,
  disabled = false,
  is_archived,
  editorRef,
  isSubmitting,
  setIsSubmitting,
  embedIssue,
  readOnly,
}: TPeekContentProps & { embedIssue: boolean; readOnly: boolean }) {
  return (
    <div className={cn("relative flex min-w-0 flex-col", embedIssue ? "gap-0" : "gap-3 space-y-3 px-8 py-5")}>
      <PeekOverviewIssueDetails
        embedIssue={embedIssue}
        editorRef={editorRef}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
        issueOperations={issueOperations}
        disabled={disabled}
        isArchived={is_archived}
        isSubmitting={isSubmitting}
        setIsSubmitting={(value) => setIsSubmitting(value)}
      />

      <div className={embedIssue ? "py-4" : "py-2"}>
        <IssueDetailWidgets
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          disabled={readOnly}
          issueServiceType={EIssueServiceType.ISSUES}
        />
      </div>

      <div className={embedIssue ? "py-4" : undefined}>
        <PeekOverviewProperties
          embedIssue={embedIssue}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={readOnly}
        />
      </div>
      <div className={embedIssue ? "pt-4" : undefined}>
        <IssueActivity
          variant={embedIssue ? "tabs" : "default"}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          disabled={is_archived}
        />
      </div>
    </div>
  );
}

function PeekFullScreenContent({
  workspaceSlug,
  projectId,
  issueId,
  issueOperations,
  disabled = false,
  is_archived,
  editorRef,
  isSubmitting,
  setIsSubmitting,
  readOnly,
}: TPeekContentProps & { readOnly: boolean }) {
  return (
    <div className="vertical-scrollbar flex h-full w-full overflow-auto">
      <div className="relative h-full w-full space-y-6 overflow-auto p-4 py-5">
        <div className="space-y-3">
          <PeekOverviewIssueDetails
            editorRef={editorRef}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            issueOperations={issueOperations}
            disabled={disabled}
            isArchived={is_archived}
            isSubmitting={isSubmitting}
            setIsSubmitting={(value) => setIsSubmitting(value)}
          />

          <div className="py-2">
            <IssueDetailWidgets
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              disabled={disabled}
              issueServiceType={EIssueServiceType.ISSUES}
            />
          </div>

          <IssueActivity workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={is_archived} />
        </div>
      </div>
      <div
        className={`vertical-scrollbar scrollbar-sm h-full !w-[400px] flex-shrink-0 overflow-hidden border-l border-subtle p-4 py-5 ${
          is_archived ? "pointer-events-none" : ""
        }`}
      >
        <PeekOverviewProperties
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

function PeekOverviewContent({
  workspaceSlug,
  projectId,
  issueId,
  issueOperations,
  disabled = false,
  embedIssue = false,
  is_archived,
  peekMode,
  editorRef,
  isSubmitting,
  setIsSubmitting,
}: IIssueView & {
  peekMode: TPeekModes;
  editorRef: React.RefObject<EditorRefApi | null>;
  isSubmitting: TNameDescriptionLoader;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
}) {
  const readOnly = disabled || is_archived;
  const ContentContainer = embedIssue ? ContentWrapper : "div";
  const sharedProps: TPeekContentProps = {
    workspaceSlug,
    projectId,
    issueId,
    issueOperations,
    disabled,
    is_archived: Boolean(is_archived),
    editorRef,
    isSubmitting,
    setIsSubmitting,
  };

  return (
    <ContentContainer
      className={cn(
        "relative min-h-0 min-w-0",
        !embedIssue && "vertical-scrollbar scrollbar-md h-full w-full overflow-hidden overflow-y-auto"
      )}
    >
      {embedIssue || ["side-peek", "modal"].includes(peekMode) ? (
        <PeekEmbeddedContent {...sharedProps} embedIssue={embedIssue} readOnly={readOnly} />
      ) : (
        <PeekFullScreenContent {...sharedProps} readOnly={readOnly} />
      )}
    </ContentContainer>
  );
}

export const IssueView = observer(function IssueView(props: IIssueView) {
  const {
    workspaceSlug,
    projectId,
    issueId,
    isLoading,
    isError,
    is_archived,
    disabled = false,
    embedIssue = false,
    embedRemoveCurrentNotification,
    issueOperations,
  } = props;
  // states
  const [peekMode, setPeekMode] = useState<TPeekModes>("side-peek");
  const [isSubmitting, setIsSubmitting] = useState<TNameDescriptionLoader>("saved");
  const [isDeleteIssueModalOpen, setIsDeleteIssueModalOpen] = useState(false);
  const [isArchiveIssueModalOpen, setIsArchiveIssueModalOpen] = useState(false);
  const [isDuplicateIssueModalOpen, setIsDuplicateIssueModalOpen] = useState(false);
  const [isEditIssueModalOpen, setIsEditIssueModalOpen] = useState(false);
  // ref
  const issuePeekOverviewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorRefApi>(null);
  // store hooks
  const {
    setPeekIssue,
    isAnyModalOpen,
    issue: { getIssueById },
  } = useIssueDetail();
  const { isAnyModalOpen: isAnyEpicModalOpen } = useIssueDetail(EIssueServiceType.EPICS);
  const issue = getIssueById(issueId);
  // remove peek id
  const removeRoutePeekId = () => {
    setPeekIssue(undefined);
    if (embedIssue && embedRemoveCurrentNotification) embedRemoveCurrentNotification();
  };

  const toggleDeleteIssueModal = (value: boolean) => setIsDeleteIssueModalOpen(value);
  const toggleArchiveIssueModal = (value: boolean) => setIsArchiveIssueModalOpen(value);
  const toggleDuplicateIssueModal = (value: boolean) => setIsDuplicateIssueModalOpen(value);
  const toggleEditIssueModal = (value: boolean) => setIsEditIssueModalOpen(value);

  const isAnyLocalModalOpen = isPeekDismissBlocked(
    isDeleteIssueModalOpen,
    isArchiveIssueModalOpen,
    isDuplicateIssueModalOpen,
    isEditIssueModalOpen
  );

  usePeekOverviewOutsideClickDetector(
    issuePeekOverviewRef,
    () => {
      const isAnyDropbarOpen = editorRef.current?.isAnyDropbarOpen();
      if (isPeekDismissBlocked(embedIssue, isAnyModalOpen, isAnyEpicModalOpen, isAnyLocalModalOpen, isAnyDropbarOpen))
        return;
      removeRoutePeekId();
    },
    issueId,
    ["main-sidebar"]
  );

  const handleKeyDown = () => handlePeekEscape(isAnyModalOpen, editorRef, issueId, removeRoutePeekId);

  useKeypress("Escape", () => !embedIssue && handleKeyDown());

  const handleRestore = async () => {
    if (!issueOperations.restore) return;
    await issueOperations.restore(workspaceSlug, projectId, issueId);
    removeRoutePeekId();
  };

  const peekOverviewIssueClassName = getPeekOverviewClassName(embedIssue, peekMode);

  const shouldUsePortal = !embedIssue;

  const portalContainer = typeof document === "undefined" ? null : document.getElementById("full-screen-portal");

  const content = (
    <div className={cn("w-full text-body-sm-regular", embedIssue && "h-full min-h-0 min-w-0")}>
      {issueId && (
        <div
          ref={issuePeekOverviewRef}
          className={peekOverviewIssueClassName}
          style={
            embedIssue
              ? undefined
              : {
                  boxShadow:
                    "0px 4px 8px 0px rgba(0, 0, 0, 0.12), 0px 6px 12px 0px rgba(16, 24, 40, 0.12), 0px 1px 16px 0px rgba(16, 24, 40, 0.12)",
                }
          }
        >
          {isError ? (
            <div className="relative h-screen w-full overflow-hidden">
              <IssuePeekOverviewError removeRoutePeekId={removeRoutePeekId} />
            </div>
          ) : (
            isLoading && <IssuePeekOverviewLoader removeRoutePeekId={removeRoutePeekId} />
          )}
          {!isLoading && !isError && issue && (
            <>
              {/* header */}
              <IssuePeekOverviewHeader
                peekMode={peekMode}
                setPeekMode={(value) => setPeekMode(value)}
                removeRoutePeekId={removeRoutePeekId}
                toggleDeleteIssueModal={toggleDeleteIssueModal}
                toggleArchiveIssueModal={toggleArchiveIssueModal}
                toggleDuplicateIssueModal={toggleDuplicateIssueModal}
                toggleEditIssueModal={toggleEditIssueModal}
                handleRestoreIssue={handleRestore}
                isArchived={is_archived}
                issueId={issueId}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                isSubmitting={isSubmitting}
                disabled={disabled}
                embedIssue={embedIssue}
              />
              {/* content */}
              <PeekOverviewContent
                {...props}
                embedIssue={embedIssue}
                disabled={disabled}
                peekMode={peekMode}
                editorRef={editorRef}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
              />
            </>
          )}
        </div>
      )}
    </div>
  );

  return <>{shouldUsePortal && portalContainer ? createPortal(content, portalContainer) : content}</>;
});
