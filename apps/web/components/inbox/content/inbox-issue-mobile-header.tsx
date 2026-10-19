import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import {
  ArrowNarrowRightOutline,
  ChevronDownOutline,
  ChevronUpOutline,
  ClockOutline,
  CloseCircleFilled,
  DeleteOutline,
  DuplicateOfOutline,
  LeftSidePaneOutline,
  LinkOutline,
  MoreHorizontalOutline,
  NewTabOutline,
  TickCircleFilled,
} from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import type { TNameDescriptionLoader } from "@plane/types";

import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { cn, findHowManyDaysLeft, generateWorkItemLink } from "@plane/utils";
// components
import { NameDescriptionUpdateStatus } from "@/components/issues/issue-update-status";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
// store types
import type { IInboxIssueStore } from "@/store/inbox/inbox-issue.store";

// local imports
import { InboxIssueStatus } from "../inbox-issue-status";

type Props = {
  workspaceSlug: string;
  inboxIssue: IInboxIssueStore | undefined;
  isSubmitting: TNameDescriptionLoader;
  handleInboxIssueNavigation: (direction: "next" | "prev") => void;
  canMarkAsAccepted: boolean;
  canMarkAsDeclined: boolean;
  isAcceptedOrDeclined: boolean | undefined;
  canMarkAsDuplicate: boolean;
  canDelete: boolean;
  setAcceptIssueModal: (value: boolean) => void;
  setDeclineIssueModal: (value: boolean) => void;
  setDeleteIssueModal: (value: boolean) => void;
  handleIssueSnoozeAction: () => Promise<void>;
  setSelectDuplicateIssue: (value: boolean) => void;
  handleCopyIssueLink: () => void;
  isMobileSidebar: boolean;
  setIsMobileSidebar: (value: boolean) => void;
  isNotificationEmbed: boolean;
  embedRemoveCurrentNotification?: () => void;
  isProjectAdmin: boolean;
  handleActionWithPermission: (isAdmin: boolean, action: () => void, errorMessage: string) => void;
};

type THandleActionWithPermission = Props["handleActionWithPermission"];

const CopyWorkItemLinkMenuItem = ({
  isAcceptedOrDeclined,
  handleCopyIssueLink,
}: {
  isAcceptedOrDeclined: boolean | undefined;
  handleCopyIssueLink: () => void;
}) => {
  const { t } = useTranslation();
  if (!isAcceptedOrDeclined) return null;

  return (
    <MenuItem icon={<Icon icon={LinkOutline} />} label={t("web.copy_work_item_link")} onClick={handleCopyIssueLink} />
  );
};

const OpenWorkItemMenuItem = ({
  isAcceptedOrDeclined,
  onOpen,
}: {
  isAcceptedOrDeclined: boolean | undefined;
  onOpen: () => void;
}) => {
  const { t } = useTranslation();
  if (!isAcceptedOrDeclined) return null;

  return <MenuItem icon={<Icon icon={NewTabOutline} />} label={t("web.open_work_item")} onClick={onOpen} />;
};

const SnoozeMenuItem = ({
  canMarkAsAccepted,
  isAcceptedOrDeclined,
  isSnoozed,
  isProjectAdmin,
  handleIssueSnoozeAction,
  handleActionWithPermission,
}: {
  canMarkAsAccepted: boolean;
  isAcceptedOrDeclined: boolean | undefined;
  isSnoozed: boolean;
  isProjectAdmin: boolean;
  handleIssueSnoozeAction: () => Promise<void>;
  handleActionWithPermission: THandleActionWithPermission;
}) => {
  const { t } = useTranslation();
  if (!canMarkAsAccepted || isAcceptedOrDeclined) return null;

  return (
    <MenuItem
      icon={<Icon icon={ClockOutline} />}
      label={isSnoozed ? t("web.un_snooze") : t("web.snooze")}
      onClick={() =>
        handleActionWithPermission(
          isProjectAdmin,
          handleIssueSnoozeAction,
          "Only project admins can snooze/Un-snooze work items"
        )
      }
    />
  );
};

const MarkAsDuplicateMenuItem = ({
  canMarkAsDuplicate,
  isAcceptedOrDeclined,
  isProjectAdmin,
  setSelectDuplicateIssue,
  handleActionWithPermission,
}: {
  canMarkAsDuplicate: boolean;
  isAcceptedOrDeclined: boolean | undefined;
  isProjectAdmin: boolean;
  setSelectDuplicateIssue: (value: boolean) => void;
  handleActionWithPermission: THandleActionWithPermission;
}) => {
  const { t } = useTranslation();
  if (!canMarkAsDuplicate || isAcceptedOrDeclined) return null;

  return (
    <MenuItem
      icon={<Icon icon={DuplicateOfOutline} />}
      label={t("web.mark_as_duplicate")}
      onClick={() =>
        handleActionWithPermission(
          isProjectAdmin,
          () => setSelectDuplicateIssue(true),
          "Only project admins can mark work items as duplicate"
        )
      }
    />
  );
};

const AcceptWorkItemMenuItem = ({
  canMarkAsAccepted,
  isProjectAdmin,
  setAcceptIssueModal,
  handleActionWithPermission,
}: {
  canMarkAsAccepted: boolean;
  isProjectAdmin: boolean;
  setAcceptIssueModal: (value: boolean) => void;
  handleActionWithPermission: THandleActionWithPermission;
}) => {
  const { t } = useTranslation();
  if (!canMarkAsAccepted) return null;

  return (
    // Propel menu rows are neutral/accent/danger only, so the accept/decline tint lives on the glyph.
    <MenuItem
      icon={<Icon icon={<TickCircleFilled className="text-success-secondary" />} />}
      label={t("web.accept")}
      onClick={() =>
        handleActionWithPermission(
          isProjectAdmin,
          () => setAcceptIssueModal(true),
          "Only project admins can accept work items"
        )
      }
    />
  );
};

const DeclineWorkItemMenuItem = ({
  canMarkAsDeclined,
  isProjectAdmin,
  setDeclineIssueModal,
  handleActionWithPermission,
}: {
  canMarkAsDeclined: boolean;
  isProjectAdmin: boolean;
  setDeclineIssueModal: (value: boolean) => void;
  handleActionWithPermission: THandleActionWithPermission;
}) => {
  const { t } = useTranslation();
  if (!canMarkAsDeclined) return null;

  return (
    <MenuItem
      icon={<Icon icon={<CloseCircleFilled className="text-danger-secondary" />} />}
      label={t("web.decline")}
      onClick={() =>
        handleActionWithPermission(
          isProjectAdmin,
          () => setDeclineIssueModal(true),
          "Only project admins can deny work items"
        )
      }
    />
  );
};

const DeleteWorkItemMenuItem = ({
  canDelete,
  isAcceptedOrDeclined,
  setDeleteIssueModal,
}: {
  canDelete: boolean;
  isAcceptedOrDeclined: boolean | undefined;
  setDeleteIssueModal: (value: boolean) => void;
}) => {
  const { t } = useTranslation();
  if (!canDelete || isAcceptedOrDeclined) return null;

  return (
    <>
      <MenuSeparator />
      <MenuItem
        variant="danger"
        icon={<Icon icon={DeleteOutline} />}
        label={t("web.delete")}
        onClick={() => setDeleteIssueModal(true)}
      />
    </>
  );
};

export const InboxIssueActionsMobileHeader = observer(function InboxIssueActionsMobileHeader(props: Props) {
  const {
    inboxIssue,
    isSubmitting,
    handleInboxIssueNavigation,
    canMarkAsAccepted,
    canMarkAsDeclined,
    canDelete,
    canMarkAsDuplicate,
    isAcceptedOrDeclined,
    workspaceSlug,
    setAcceptIssueModal,
    setDeclineIssueModal,
    setDeleteIssueModal,
    handleIssueSnoozeAction,
    setSelectDuplicateIssue,
    handleCopyIssueLink,
    isMobileSidebar,
    setIsMobileSidebar,
    isNotificationEmbed,
    embedRemoveCurrentNotification,
    isProjectAdmin,
    handleActionWithPermission,
  } = props;
  const router = useAppRouter();
  const { t } = useTranslation();
  const { getProjectIdentifierById } = useProject();

  const issue = inboxIssue?.issue;
  const currentInboxIssueId = issue?.id;
  // days left for snooze
  const numberOfDaysLeft = findHowManyDaysLeft(inboxIssue?.snoozed_till);
  const isSnoozed = Boolean(inboxIssue?.snoozed_till && numberOfDaysLeft && numberOfDaysLeft > 0);

  if (!issue || !inboxIssue) return null;

  const projectIdentifier = getProjectIdentifierById(issue?.project_id);

  const workItemLink = generateWorkItemLink({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: issue?.project_id,
    issueId: currentInboxIssueId,
    projectIdentifier,
    sequenceId: issue?.sequence_id,
  });

  return (
    <Header variant={EHeaderVariant.SECONDARY} className="justify-start">
      {isNotificationEmbed && (
        <button onClick={embedRemoveCurrentNotification}>
          <ArrowNarrowRightOutline className="mr-2 h-4 w-4 text-tertiary hover:text-secondary" />
        </button>
      )}
      <LeftSidePaneOutline
        onClick={() => setIsMobileSidebar(!isMobileSidebar)}
        className={cn("my-auto mr-2 h-4 w-4 flex-shrink-0", isMobileSidebar ? "text-accent-primary" : "text-secondary")}
      />
      <div className="z-[15] flex w-full items-center gap-2 bg-surface-1">
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
        <div className="flex items-center gap-4">
          <InboxIssueStatus inboxIssue={inboxIssue} iconSize={12} />
          <div className="flex w-full items-center justify-end">
            <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
          </div>
        </div>
        <div className="ml-auto">
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
              <CopyWorkItemLinkMenuItem
                isAcceptedOrDeclined={isAcceptedOrDeclined}
                handleCopyIssueLink={handleCopyIssueLink}
              />
              <OpenWorkItemMenuItem
                isAcceptedOrDeclined={isAcceptedOrDeclined}
                onOpen={() => router.push(workItemLink)}
              />
              <SnoozeMenuItem
                canMarkAsAccepted={canMarkAsAccepted}
                isAcceptedOrDeclined={isAcceptedOrDeclined}
                isSnoozed={isSnoozed}
                isProjectAdmin={isProjectAdmin}
                handleIssueSnoozeAction={handleIssueSnoozeAction}
                handleActionWithPermission={handleActionWithPermission}
              />
              <MarkAsDuplicateMenuItem
                canMarkAsDuplicate={canMarkAsDuplicate}
                isAcceptedOrDeclined={isAcceptedOrDeclined}
                isProjectAdmin={isProjectAdmin}
                setSelectDuplicateIssue={setSelectDuplicateIssue}
                handleActionWithPermission={handleActionWithPermission}
              />
              <AcceptWorkItemMenuItem
                canMarkAsAccepted={canMarkAsAccepted}
                isProjectAdmin={isProjectAdmin}
                setAcceptIssueModal={setAcceptIssueModal}
                handleActionWithPermission={handleActionWithPermission}
              />
              <DeclineWorkItemMenuItem
                canMarkAsDeclined={canMarkAsDeclined}
                isProjectAdmin={isProjectAdmin}
                setDeclineIssueModal={setDeclineIssueModal}
                handleActionWithPermission={handleActionWithPermission}
              />
              <DeleteWorkItemMenuItem
                canDelete={canDelete}
                isAcceptedOrDeclined={isAcceptedOrDeclined}
                setDeleteIssueModal={setDeleteIssueModal}
              />
            </MenuContent>
          </Menu>
        </div>
      </div>
    </Header>
  );
});
