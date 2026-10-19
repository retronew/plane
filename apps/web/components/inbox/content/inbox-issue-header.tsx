import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { observer } from "mobx-react";
import {
  ArrowNarrowRightOutline,
  ChevronDownOutline,
  ChevronUpOutline,
  ClockOutline,
  CloseCircleFilled,
  DeleteOutline,
  DuplicateOfOutline,
  LinkOutline,
  MoreHorizontalOutline,
  NewTabOutline,
  TickCircleFilled,
} from "@makeplane/propel/icons";
import { Copy } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import { setToast } from "@plane/blocks/toast";
import type { TNameDescriptionLoader } from "@plane/types";
import { EInboxIssueStatus } from "@plane/types";
import { Row } from "@plane/blocks/layout";
import { copyUrlToClipboard, findHowManyDaysLeft, generateWorkItemLink } from "@plane/utils";
// components
import { CreateUpdateIssueModal } from "@/components/issues/issue-modal/modal";
import { NameDescriptionUpdateStatus } from "@/components/issues/issue-update-status";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// store
import type { IInboxIssueStore } from "@/store/inbox/inbox-issue.store";
// local imports
import { InboxIssueStatus } from "../inbox-issue-status";
import { DeclineIssueModal } from "../modals/decline-issue-modal";
import { DeleteInboxIssueModal } from "../modals/delete-issue-modal";
import { SelectDuplicateInboxIssueModal } from "../modals/select-duplicate";
import { InboxIssueSnoozeModal } from "../modals/snooze-issue-modal";
import { InboxIssueActionsMobileHeader } from "./inbox-issue-mobile-header";

type TInboxIssueActionsHeader = {
  workspaceSlug: string;
  projectId: string;
  inboxIssue: IInboxIssueStore | undefined;
  isSubmitting: TNameDescriptionLoader;
  isMobileSidebar: boolean;
  setIsMobileSidebar: (value: boolean) => void;
  isNotificationEmbed: boolean;
  embedRemoveCurrentNotification?: () => void;
};

type TTranslationFn = ReturnType<typeof useTranslation>["t"];

type TAllowPermissions = (
  permissions: EUserPermissions[],
  level: EUserPermissionsLevel,
  workspaceSlug?: string,
  projectId?: string
) => boolean;

type TInboxIssuePermissions = {
  isAllowed: boolean;
  canMarkAsDuplicate: boolean;
  canMarkAsAccepted: boolean;
  canMarkAsDeclined: boolean;
  canDelete: boolean;
  isProjectAdmin: boolean;
  isAcceptedOrDeclined: boolean | undefined;
  numberOfDaysLeft: number | undefined;
};

const getInboxIssuePermissions = (
  allowPermissions: TAllowPermissions,
  workspaceSlug: string,
  projectId: string,
  inboxIssue: IInboxIssueStore | undefined,
  currentUserId: string | undefined
): TInboxIssuePermissions => {
  const isAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  const isPending = inboxIssue?.status === 0 || inboxIssue?.status === -2;
  return {
    isAllowed,
    canMarkAsDuplicate: isAllowed && isPending,
    canMarkAsAccepted: isAllowed && isPending,
    canMarkAsDeclined: isAllowed && isPending,
    canDelete:
      allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId) ||
      inboxIssue?.issue?.created_by === currentUserId,
    isProjectAdmin: allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId),
    isAcceptedOrDeclined: inboxIssue?.status ? [-1, 1, 2].includes(inboxIssue.status) : undefined,
    numberOfDaysLeft: findHowManyDaysLeft(inboxIssue?.snoozed_till),
  };
};

const canUnsnoozeIssue = (inboxIssue: IInboxIssueStore | undefined, numberOfDaysLeft: number | undefined) =>
  Boolean(inboxIssue?.snoozed_till && numberOfDaysLeft && numberOfDaysLeft > 0);

const getRedirectIssueId = (issueIds: string[], currentIssueId: string | undefined): string | undefined => {
  const currentIssueIndex = issueIds.findIndex((id) => id === currentIssueId);
  const nextIssueId = issueIds[currentIssueIndex + 1];
  if (nextIssueId) return nextIssueId;
  return issueIds[currentIssueIndex - 1] || undefined;
};

const getNextIssueId = (
  issueIds: string[],
  currentIssueIndex: number,
  direction: "next" | "prev"
): string | undefined => {
  if (issueIds.length === 0) return undefined;
  const nextIssueIndex =
    direction === "next"
      ? (currentIssueIndex + 1) % issueIds.length
      : (currentIssueIndex - 1 + issueIds.length) % issueIds.length;
  return issueIds[nextIssueIndex];
};

const isComposerFocused = () => {
  const activeElement = document.activeElement as HTMLElement | null;
  if (!activeElement) return false;
  return activeElement.classList.contains("tiptap") || activeElement.id === "title-input";
};

const getIntakeHref = (workspaceSlug: string, projectId: string, currentTab: string, inboxIssueId?: string): string => {
  const issueQuery = inboxIssueId ? `&inboxIssueId=${inboxIssueId}` : "";
  return `/${workspaceSlug}/projects/${projectId}/intake?currentTab=${currentTab}${issueQuery}`;
};

type TInboxIssueActionsMenuProps = {
  canMarkAsAccepted: boolean;
  canMarkAsDuplicate: boolean;
  canDelete: boolean;
  canUnsnooze: boolean;
  t: TTranslationFn;
  onSnooze: () => void;
  onMarkAsDuplicate: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
};

function InboxIssueActionsMenu(props: TInboxIssueActionsMenuProps) {
  const { canMarkAsAccepted, canMarkAsDuplicate, canDelete, canUnsnooze, t, onSnooze, onMarkAsDuplicate } = props;
  const { onCopyLink, onDelete } = props;
  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            variant="secondary"
            size="md"
            icon={<Icon icon={MoreHorizontalOutline} />}
            aria-label={t("aria_labels.common.more_actions")}
          />
        }
      />
      <MenuContent side="bottom" align="start">
        {canMarkAsAccepted && (
          <MenuItem
            icon={<Icon icon={ClockOutline} />}
            label={canUnsnooze ? t("inbox_issue.actions.unsnooze") : t("inbox_issue.actions.snooze")}
            onClick={onSnooze}
          />
        )}
        {canMarkAsDuplicate && (
          <MenuItem
            icon={<Icon icon={DuplicateOfOutline} />}
            label={t("inbox_issue.actions.mark_as_duplicate")}
            onClick={onMarkAsDuplicate}
          />
        )}
        <MenuItem icon={<Icon icon={Copy} />} label={t("inbox_issue.actions.copy")} onClick={onCopyLink} />
        {canDelete && (
          <>
            <MenuSeparator />
            <MenuItem
              variant="danger"
              icon={<Icon icon={DeleteOutline} />}
              label={t("inbox_issue.actions.delete")}
              onClick={onDelete}
            />
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

export const InboxIssueActionsHeader = observer(function InboxIssueActionsHeader(props: TInboxIssueActionsHeader) {
  const {
    workspaceSlug,
    projectId,
    inboxIssue,
    isSubmitting,
    isMobileSidebar,
    setIsMobileSidebar,
    isNotificationEmbed = false,
    embedRemoveCurrentNotification,
  } = props;
  // states
  const [isSnoozeDateModalOpen, setIsSnoozeDateModalOpen] = useState(false);
  const [selectDuplicateIssue, setSelectDuplicateIssue] = useState(false);
  const [acceptIssueModal, setAcceptIssueModal] = useState(false);
  const [declineIssueModal, setDeclineIssueModal] = useState(false);
  const [deleteIssueModal, setDeleteIssueModal] = useState(false);
  // store
  const { currentTab, deleteInboxIssue, filteredInboxIssueIds } = useProjectInbox();
  const { data: currentUser } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { getPartialProjectById } = useProject();
  const currentProjectDetails = getPartialProjectById(projectId);
  const { t } = useTranslation();

  const router = useAppRouter();
  const { getProjectById } = useProject();

  const issue = inboxIssue?.issue;
  // derived values
  const {
    isAllowed,
    canMarkAsDuplicate,
    canMarkAsAccepted,
    canMarkAsDeclined,
    canDelete,
    isProjectAdmin,
    isAcceptedOrDeclined,
    numberOfDaysLeft,
  } = getInboxIssuePermissions(allowPermissions, workspaceSlug, projectId, inboxIssue, currentUser?.id);
  const canUnsnooze = canUnsnoozeIssue(inboxIssue, numberOfDaysLeft);

  const currentInboxIssueId = inboxIssue?.issue?.id;

  const redirectIssue = (): string | undefined => getRedirectIssueId(filteredInboxIssueIds, currentInboxIssueId);

  const handleRedirection = (nextOrPreviousIssueId: string | undefined) => {
    if (!isNotificationEmbed) {
      router.push(getIntakeHref(workspaceSlug, projectId, currentTab, nextOrPreviousIssueId));
    }
  };

  const handleInboxIssueAccept = async () => {
    const nextOrPreviousIssueId = redirectIssue();
    await inboxIssue?.updateInboxIssueStatus(EInboxIssueStatus.ACCEPTED);
    setAcceptIssueModal(false);
    handleRedirection(nextOrPreviousIssueId);
  };

  const handleInboxIssueDecline = async () => {
    const nextOrPreviousIssueId = redirectIssue();
    await inboxIssue?.updateInboxIssueStatus(EInboxIssueStatus.DECLINED);
    setDeclineIssueModal(false);
    handleRedirection(nextOrPreviousIssueId);
  };

  const handleInboxIssueSnooze = async (date: Date) => {
    const nextOrPreviousIssueId = redirectIssue();
    await inboxIssue?.updateInboxIssueSnoozeTill(date);
    setIsSnoozeDateModalOpen(false);
    handleRedirection(nextOrPreviousIssueId);
  };

  const handleInboxIssueDuplicate = async (issueId: string) => {
    await inboxIssue?.updateInboxIssueDuplicateTo(issueId);
  };

  const handleInboxIssueDelete = async () => {
    if (!inboxIssue || !currentInboxIssueId) return;
    await deleteInboxIssue(workspaceSlug, projectId, currentInboxIssueId).then(() => {
      if (!isNotificationEmbed) router.push(`/${workspaceSlug}/projects/${projectId}/intake`);
      return undefined;
    });
  };

  const handleIssueSnoozeAction = async () => {
    if (canUnsnooze) {
      const nextOrPreviousIssueId = redirectIssue();
      await inboxIssue?.updateInboxIssueSnoozeTill(undefined);
      handleRedirection(nextOrPreviousIssueId);
    } else {
      setIsSnoozeDateModalOpen(true);
    }
  };

  const handleCopyIssueLink = (path: string) =>
    copyUrlToClipboard(path).then(() =>
      setToast({
        type: "success",
        title: t("common.link_copied"),
        message: t("common.copied_to_clipboard"),
      })
    );

  const currentIssueIndex = filteredInboxIssueIds.findIndex((issueId) => issueId === currentInboxIssueId) ?? 0;

  const handleInboxIssueNavigation = useCallback(
    (direction: "next" | "prev") => {
      if (!filteredInboxIssueIds || !currentInboxIssueId) return;
      if (isComposerFocused()) return;
      const nextIssueId = getNextIssueId(filteredInboxIssueIds, currentIssueIndex, direction);
      if (!nextIssueId) return;
      router.push(`/${workspaceSlug}/projects/${projectId}/intake?inboxIssueId=${nextIssueId}`);
    },
    [currentInboxIssueId, currentIssueIndex, filteredInboxIssueIds, projectId, router, workspaceSlug]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        handleInboxIssueNavigation("prev");
      } else if (e.key === "ArrowDown") {
        handleInboxIssueNavigation("next");
      }
    },
    [handleInboxIssueNavigation]
  );

  const handleActionWithPermission = (isAdmin: boolean, action: () => void, errorMessage: string) => {
    if (isAdmin) action();
    else {
      setToast({
        type: "error",
        title: t("web.permission_denied"),
        message: errorMessage,
      });
    }
  };

  useEffect(() => {
    if (isSubmitting === "submitting") return;
    if (!isNotificationEmbed) document.addEventListener("keydown", onKeyDown);
    return () => {
      if (!isNotificationEmbed) document.removeEventListener("keydown", onKeyDown);
    };
  }, [onKeyDown, isNotificationEmbed, isSubmitting]);

  if (!inboxIssue) return null;

  const workItemLink = generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: issue?.project_id,
    issueId: currentInboxIssueId,
    projectIdentifier: currentProjectDetails?.identifier,
    sequenceId: issue?.sequence_id,
  });

  // Plain click navigates in-app; Cmd/Ctrl+click keeps the browser's open-in-new-tab behaviour.
  const handleOpenIssueLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.button === 0) return;
    event.preventDefault();
    router.push(workItemLink);
  };

  return (
    <>
      <>
        <SelectDuplicateInboxIssueModal
          isOpen={selectDuplicateIssue}
          onClose={() => setSelectDuplicateIssue(false)}
          value={inboxIssue?.duplicate_to}
          onSubmit={handleInboxIssueDuplicate}
        />
        <CreateUpdateIssueModal
          data={inboxIssue?.issue}
          isOpen={acceptIssueModal}
          onClose={() => setAcceptIssueModal(false)}
          beforeFormSubmit={handleInboxIssueAccept}
          withDraftIssueWrapper={false}
          fetchIssueDetails={false}
          showActionItemsOnUpdate
          modalTitle={t("inbox_issue.actions.move", {
            value: `${currentProjectDetails?.identifier}-${issue?.sequence_id}`,
          })}
          primaryButtonText={{
            default: t("add_to_project"),
            loading: t("adding"),
          }}
        />
        <DeclineIssueModal
          data={inboxIssue?.issue || {}}
          isOpen={declineIssueModal}
          onClose={() => setDeclineIssueModal(false)}
          onSubmit={handleInboxIssueDecline}
        />
        <DeleteInboxIssueModal
          data={inboxIssue?.issue}
          isOpen={deleteIssueModal}
          onClose={() => setDeleteIssueModal(false)}
          onSubmit={handleInboxIssueDelete}
        />
        <InboxIssueSnoozeModal
          isOpen={isSnoozeDateModalOpen}
          handleClose={() => setIsSnoozeDateModalOpen(false)}
          value={inboxIssue?.snoozed_till}
          onConfirm={handleInboxIssueSnooze}
        />
      </>

      <Row className="relative z-15 hidden h-full w-full items-center justify-between gap-2 border-b border-subtle bg-surface-1 lg:flex">
        <div className="flex items-center gap-4">
          {isNotificationEmbed && (
            <button onClick={embedRemoveCurrentNotification}>
              <ArrowNarrowRightOutline className="h-4 w-4 text-tertiary hover:text-secondary" />
            </button>
          )}
          {issue?.project_id && issue.sequence_id && (
            <h3 className="flex-shrink-0 text-14 font-medium text-tertiary">
              {getProjectById(issue.project_id)?.identifier}-{issue.sequence_id}
            </h3>
          )}
          <InboxIssueStatus inboxIssue={inboxIssue} iconSize={12} />
          <div className="flex w-full items-center justify-end">
            <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNotificationEmbed && (
            <div className="flex items-center gap-x-2">
              <IconButton
                variant="secondary"
                size="md"
                icon={<Icon icon={ChevronUpOutline} />}
                aria-label={t("web.previous_work_item")}
                onClick={() => handleInboxIssueNavigation("prev")}
              />
              <IconButton
                variant="secondary"
                size="md"
                icon={<Icon icon={ChevronDownOutline} />}
                aria-label={t("web.next_work_item")}
                onClick={() => handleInboxIssueNavigation("next")}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {canMarkAsAccepted && (
              <Button
                variant="secondary"
                size="md"
                stretch="auto"
                onClick={() =>
                  handleActionWithPermission(
                    isProjectAdmin,
                    () => setAcceptIssueModal(true),
                    t("inbox_issue.errors.accept_permission")
                  )
                }
                icon={<Icon icon={<TickCircleFilled className="size-4 shrink-0 text-success-secondary" />} />}
                label={t("inbox_issue.actions.accept")}
              />
            )}

            {canMarkAsDeclined && (
              <Button
                variant="secondary"
                size="md"
                stretch="auto"
                onClick={() =>
                  handleActionWithPermission(
                    isProjectAdmin,
                    () => setDeclineIssueModal(true),
                    t("inbox_issue.errors.decline_permission")
                  )
                }
                icon={<Icon icon={<CloseCircleFilled className="size-4 shrink-0 text-danger-secondary" />} />}
                label={t("inbox_issue.actions.decline")}
              />
            )}

            {isAcceptedOrDeclined ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  stretch="auto"
                  icon={<Icon icon={LinkOutline} />}
                  iconPosition="start"
                  onClick={() => handleCopyIssueLink(workItemLink)}
                  label={t("inbox_issue.actions.copy")}
                />
                <Button
                  variant="secondary"
                  size="md"
                  stretch="auto"
                  nativeButton={false}
                  render={<a href={workItemLink} target="_self" aria-label={t("inbox_issue.actions.open")} />}
                  onClick={handleOpenIssueLink}
                  icon={<Icon icon={NewTabOutline} />}
                  iconPosition="start"
                  label={t("inbox_issue.actions.open")}
                />
              </div>
            ) : (
              <>
                {isAllowed && (
                  <InboxIssueActionsMenu
                    canMarkAsAccepted={canMarkAsAccepted}
                    canMarkAsDuplicate={canMarkAsDuplicate}
                    canDelete={canDelete}
                    canUnsnooze={canUnsnooze}
                    t={t}
                    onSnooze={() =>
                      handleActionWithPermission(
                        isProjectAdmin,
                        handleIssueSnoozeAction,
                        t("inbox_issue.errors.snooze_permission")
                      )
                    }
                    onMarkAsDuplicate={() =>
                      handleActionWithPermission(
                        isProjectAdmin,
                        () => setSelectDuplicateIssue(true),
                        "Only project admins can mark work item as duplicate"
                      )
                    }
                    onCopyLink={() => handleCopyIssueLink(workItemLink)}
                    onDelete={() => setDeleteIssueModal(true)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </Row>

      <div className="lg:hidden">
        <InboxIssueActionsMobileHeader
          inboxIssue={inboxIssue}
          isSubmitting={isSubmitting}
          handleCopyIssueLink={() => handleCopyIssueLink(workItemLink)}
          setAcceptIssueModal={setAcceptIssueModal}
          setDeclineIssueModal={setDeclineIssueModal}
          handleIssueSnoozeAction={handleIssueSnoozeAction}
          setSelectDuplicateIssue={setSelectDuplicateIssue}
          setDeleteIssueModal={setDeleteIssueModal}
          canMarkAsAccepted={canMarkAsAccepted}
          canMarkAsDeclined={canMarkAsDeclined}
          canMarkAsDuplicate={canMarkAsDuplicate}
          canDelete={canDelete}
          isAcceptedOrDeclined={isAcceptedOrDeclined}
          handleInboxIssueNavigation={handleInboxIssueNavigation}
          workspaceSlug={workspaceSlug}
          isMobileSidebar={isMobileSidebar}
          setIsMobileSidebar={setIsMobileSidebar}
          isNotificationEmbed={isNotificationEmbed}
          embedRemoveCurrentNotification={embedRemoveCurrentNotification}
          isProjectAdmin={isProjectAdmin}
          handleActionWithPermission={handleActionWithPermission}
        />
      </div>
    </>
  );
});
