import { BellRing } from "lucide-react";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { ClockOutline } from "@makeplane/propel/icons";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Row } from "@plane/blocks/layout";
import type { IUserLite, TNotification } from "@plane/types";
import { cn, calculateTimeAgo, renderFormattedDate, renderFormattedTime, getFileURL } from "@plane/utils";
// hooks
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useNotification } from "@/hooks/store/notifications/use-notification";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useWorkspace } from "@/hooks/store/use-workspace";
// local imports
import { NotificationContent, NotificationTitle } from "./content";
import { NotificationOption } from "./options";
import { translate } from "@plane/i18n";

type TNotificationItem = {
  workspaceSlug: string;
  notificationId: string;
};

type TNotificationPeekTarget = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

const getNotificationProjectId = (notification: TNotification | undefined): string | undefined =>
  notification?.project || undefined;

const getNotificationIssueId = (notification: TNotification | undefined): string | undefined =>
  notification?.data?.issue?.id ?? notification?.data?.issue_id;

const getNotificationTriggeredBy = (notification: TNotification | undefined): IUserLite | undefined =>
  notification?.triggered_by_details || undefined;

const getNotificationPeekTarget = ({
  workspaceSlug,
  projectId,
  issueId,
  isSnoozeStateModalOpen,
  customSnoozeModal,
}: {
  workspaceSlug: string;
  projectId: string | undefined;
  issueId: string | undefined;
  isSnoozeStateModalOpen: boolean;
  customSnoozeModal: boolean;
}): TNotificationPeekTarget | undefined => {
  if (!workspaceSlug || !projectId || !issueId || isSnoozeStateModalOpen || customSnoozeModal) return undefined;
  return { workspaceSlug, projectId, issueId };
};

const shouldOpenNotificationIssuePeek = (
  notification: TNotification,
  issueId: string,
  getIsIssuePeeked: (issueId: string) => boolean
) => notification.is_inbox_issue === false && !getIsIssuePeeked(issueId);

const markNotificationAsReadIfUnread = async (
  notification: TNotification,
  workspaceSlug: string,
  markNotificationAsRead: (workspaceSlug: string) => Promise<unknown>
) => {
  if (notification.read_at !== null) return;

  try {
    await markNotificationAsRead(workspaceSlug);
  } catch (error) {
    console.error(error);
  }
};

const NotificationItemAvatar = ({
  sender,
  triggeredBy,
}: {
  sender: string | undefined;
  triggeredBy: IUserLite | undefined;
}) => (
  <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-layer-1">
    {sender === "in_app:issue_reminder:due" && <BellRing className="size-5 text-secondary" />}
    {triggeredBy && (
      <Avatar
        alt={triggeredBy.display_name || triggeredBy.first_name}
        fallback={(triggeredBy.display_name || triggeredBy.first_name)?.[0]?.toUpperCase()}
        src={getFileURL(triggeredBy.avatar_url)}
        size="xl"
      />
    )}
  </div>
);

const NotificationItemSummary = ({ notification }: { notification: TNotification }) => {
  if (!notification.data?.issue) return <NotificationTitle notification={notification} />;

  return (
    <>
      {notification.data.issue.identifier}-{notification.data.issue.sequence_id}&nbsp;
      {notification.data.issue.name}
    </>
  );
};

const NotificationItemTimestamp = ({ notification }: { notification: TNotification }) => {
  if (notification.snoozed_till) {
    return (
      <p className="flex flex-shrink-0 items-center justify-end gap-x-1 text-tertiary">
        <ClockOutline className="h-4 w-4" />
        <span>
          {translate("web.till")} {renderFormattedDate(notification.snoozed_till)},&nbsp;
          {renderFormattedTime(notification.snoozed_till, "12-hour")}
        </span>
      </p>
    );
  }

  return (
    <p className="mt-auto flex-shrink-0 text-tertiary">
      {notification.created_at && calculateTimeAgo(notification.created_at)}
    </p>
  );
};

export const NotificationItem = observer(function NotificationItem(props: TNotificationItem) {
  const { workspaceSlug, notificationId } = props;
  // hooks
  const { currentSelectedNotificationId, setCurrentSelectedNotificationId } = useWorkspaceNotifications();
  const { asJson: notification, markNotificationAsRead } = useNotification(notificationId);
  const { getIsIssuePeeked, setPeekIssue } = useIssueDetail();
  const { getWorkspaceBySlug } = useWorkspace();
  // states
  const [isSnoozeStateModalOpen, setIsSnoozeStateModalOpen] = useState(false);
  const [customSnoozeModal, setCustomSnoozeModal] = useState(false);

  // derived values
  const projectId = getNotificationProjectId(notification);
  const issueId = getNotificationIssueId(notification);
  const workspace = getWorkspaceBySlug(workspaceSlug);
  const notificationTriggeredBy = getNotificationTriggeredBy(notification);

  const handleNotificationIssuePeekOverview = async () => {
    const peekTarget = getNotificationPeekTarget({
      workspaceSlug,
      projectId,
      issueId,
      isSnoozeStateModalOpen,
      customSnoozeModal,
    });
    if (!peekTarget) return;

    setPeekIssue(undefined);
    setCurrentSelectedNotificationId(notificationId);

    // make the notification as read
    await markNotificationAsReadIfUnread(notification, workspaceSlug, markNotificationAsRead);

    if (!shouldOpenNotificationIssuePeek(notification, peekTarget.issueId, getIsIssuePeeked)) return;
    setPeekIssue(peekTarget);
  };

  if (!workspaceSlug || !notificationId || !notification?.id || !workspace?.id || !projectId) return <></>;

  return (
    <Row
      className={cn(
        "group relative flex cursor-pointer items-center gap-2 border-b border-subtle py-4 transition-all",
        {
          "bg-layer-1/30": currentSelectedNotificationId === notification?.id,
          "bg-accent-primary/5": notification.read_at === null,
        }
      )}
      onClick={handleNotificationIssuePeekOverview}
    >
      {notification.read_at === null && (
        <div className="absolute top-[50%] left-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-primary" />
      )}

      <div className="relative flex w-full gap-2">
        <NotificationItemAvatar sender={notification.sender} triggeredBy={notificationTriggeredBy} />

        <div className="-mt-2 w-full space-y-1">
          <div className="relative flex h-8 items-center gap-3">
            <div className="line-clamp-1 w-full truncate overflow-hidden text-body-xs-medium break-all whitespace-normal text-primary">
              <NotificationContent
                notification={notification}
                workspaceId={workspace.id}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
              />
            </div>
            <NotificationOption
              workspaceSlug={workspaceSlug}
              notificationId={notification?.id}
              isSnoozeStateModalOpen={isSnoozeStateModalOpen}
              setIsSnoozeStateModalOpen={setIsSnoozeStateModalOpen}
              customSnoozeModal={customSnoozeModal}
              setCustomSnoozeModal={setCustomSnoozeModal}
            />
          </div>

          <div className="relative flex items-center gap-3 text-caption-sm-regular text-secondary">
            <div className="line-clamp-1 w-full truncate overflow-hidden break-words whitespace-normal">
              <NotificationItemSummary notification={notification} />
            </div>
            <div className="flex-shrink-0">
              <NotificationItemTimestamp notification={notification} />
            </div>
          </div>
        </div>
      </div>
    </Row>
  );
});
