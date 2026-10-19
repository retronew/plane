/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import type { ReactNode } from "react";
// plane imports
import type { TNotification } from "@plane/types";
import {
  convertMinutesToHoursMinutesString,
  renderFormattedDate,
  sanitizeCommentForNotification,
  stripAndTruncateHTML,
} from "@plane/utils";
// components
import { LiteTextEditor } from "@/components/editor/lite-text";
import { ADDITIONAL_NOTIFICATION_CONTENT_MAP, renderAdditionalValue } from "../../notification-card/content";

// Types
export type TNotificationFieldData = {
  field: string | undefined;
  newValue: string | undefined;
  oldValue: string | undefined;
  verb: string | undefined;
};

export type TNotificationContentDetails = {
  action?: ReactNode;
  translationKey?: string;
  value?: ReactNode;
  showConnector?: boolean;
};

export type TNotificationContentHandler = (data: TNotificationFieldData) => TNotificationContentDetails | null;

export type TNotificationContentMap = {
  [key: string]: TNotificationContentHandler;
};

// Base notification content map for core fields
export const BASE_NOTIFICATION_CONTENT_MAP: TNotificationContentMap = {
  approval: ({ verb }) => ({
    translationKey: "approval_activity",
    value: (
      <Translation
        translationKey={`web.workflow_ui.approval_activity.${
          ["requested", "approved", "rejected", "cancelled"].includes(verb ?? "") ? verb : "updated"
        }`}
      />
    ),
  }),
  duplicate: ({ verb }) => ({ translationKey: verb === "created" ? "duplicate_added" : "duplicate_removed" }),
  assignees: ({ newValue, oldValue }) => ({
    translationKey: newValue ? "assignee_added" : "assignee_removed",
    value: newValue || oldValue,
  }),
  start_date: ({ newValue }) => ({
    translationKey: newValue ? "start_date_set" : "start_date_removed",
    value: newValue ? renderFormattedDate(newValue) : undefined,
  }),
  target_date: ({ newValue }) => ({
    translationKey: newValue ? "due_date_set" : "due_date_removed",
    value: newValue ? renderFormattedDate(newValue) : undefined,
  }),
  labels: ({ newValue, oldValue }) => ({
    translationKey: newValue ? "label_added" : "label_removed",
    value: newValue || oldValue,
  }),
  parent: ({ newValue, oldValue }) => ({
    translationKey: newValue ? "parent_added" : "parent_removed",
    value: newValue || oldValue,
  }),
  relates_to: ({ newValue, oldValue, verb }) => ({
    translationKey: verb === "deleted" ? "relation_removed" : "relation_added",
    value: newValue || oldValue,
  }),
  comment: ({ newValue }, renderCommentBox?: boolean) => ({
    translationKey: renderCommentBox ? "commented" : "commented_value",
    value: renderCommentBox ? null : sanitizeCommentForNotification(newValue),
  }),
  archived_at: ({ newValue }) => ({ translationKey: newValue === "restore" ? "restored" : "archived" }),
  None: () => ({ translationKey: "assigned_to_you" }),
  due_reminder: ({ newValue }) => ({
    translationKey: "due_reminder",
    value: newValue ? renderFormattedDate(newValue) : undefined,
  }),
  intake_created: () => ({ translationKey: "intake_request_created" }),
  attachment: ({ verb }) => ({ translationKey: verb === "deleted" ? "attachment_removed" : "attachment_added" }),
  description: ({ newValue }) => ({ translationKey: "description", value: stripAndTruncateHTML(newValue || "", 55) }),
  estimate_time: ({ newValue, oldValue }) => ({
    translationKey: newValue ? "estimate_set" : "estimate_removed",
    value: convertMinutesToHoursMinutesString(Number(newValue || oldValue)),
  }),
};

// Helper to get content details from maps
const getNotificationContentDetails = (
  fieldData: TNotificationFieldData,
  renderCommentBox?: boolean
): TNotificationContentDetails | null => {
  const { field } = fieldData;
  if (!field) return null;

  // Check base map first
  const baseHandler = BASE_NOTIFICATION_CONTENT_MAP[field];
  if (baseHandler) {
    // Special case for comment field that needs renderCommentBox
    if (field === "comment") {
      return (baseHandler as (data: TNotificationFieldData, renderCommentBox?: boolean) => TNotificationContentDetails)(
        fieldData,
        renderCommentBox
      );
    }
    return baseHandler(fieldData);
  }

  // Check additional map from plane-web (EE extensions)
  const additionalHandler = ADDITIONAL_NOTIFICATION_CONTENT_MAP[field];
  if (additionalHandler) {
    return additionalHandler(fieldData);
  }

  return null;
};

export function NotificationTitle({ notification }: { notification: TNotification }) {
  if (notification.data?.event === "approval_requested") {
    // Older approval notifications only store the work item name in the title.
    const name = notification.data.issue?.name ?? notification.title?.replace(/^Approval requested: /, "");
    return name ? (
      <Translation translationKey="web.notifications.approval_requested_title" values={{ name }} />
    ) : (
      <Translation translationKey="web.workflow_ui.pending_approval" />
    );
  }
  return <>{notification.title}</>;
}

const NOTIFICATION_FIELD_KEYS: Record<string, string> = {
  name: "common.title",
  priority: "priority",
  state: "state",
  cycles: "common.cycle",
  modules: "common.module",
  estimate_point: "common.estimate",
};

function getNotificationTranslationKey(details: TNotificationContentDetails | null, verb: string | undefined): string {
  if (details?.translationKey) return details.translationKey;
  if (details?.action !== undefined) return "extension";
  return verb === "deleted" ? "property_removed" : "property_set";
}

function getNotificationValue(
  details: TNotificationContentDetails | null,
  field: string,
  newValue: string | undefined,
  oldValue: string | undefined
) {
  if (details && "value" in details) return details.value;
  return renderAdditionalValue(field, newValue, oldValue);
}

function NotificationCommentBox({
  newValue,
  workspaceId,
  workspaceSlug,
  projectId,
}: {
  newValue: string | undefined;
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
}) {
  return (
    <div className="origin-left scale-75">
      <LiteTextEditor
        editable={false}
        id=""
        initialValue={newValue ?? ""}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        displayConfig={{
          fontSize: "small-font",
        }}
      />
    </div>
  );
}

export function NotificationContent({
  notification,
  workspaceId,
  workspaceSlug,
  projectId,
  renderCommentBox = false,
}: {
  notification: TNotification;
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  renderCommentBox?: boolean;
}) {
  const { data, triggered_by_details: triggeredBy } = notification;
  const { field, new_value: newValue, old_value: oldValue, verb } = data?.issue_activity ?? {};
  const notificationField = notification.sender === "in_app:intake:created" ? "intake_created" : field;

  if (data?.event === "approval_requested") {
    return <Translation translationKey="web.workflow_ui.pending_approval" />;
  }
  if (!notificationField) return <>{notification.title}</>;

  const fieldData: TNotificationFieldData = {
    field: notificationField,
    newValue,
    oldValue,
    verb,
  };

  const renderTriggerName = () => (
    <span className="font-medium text-primary">
      {triggeredBy?.is_bot ? triggeredBy.first_name : triggeredBy?.display_name}{" "}
    </span>
  );

  // Get content details from map
  const contentDetails = getNotificationContentDetails(fieldData, renderCommentBox);

  const key = getNotificationTranslationKey(contentDetails, verb);
  const value = getNotificationValue(contentDetails, notificationField, newValue, oldValue);
  const showCommentBox = verb !== "deleted" && notificationField === "comment" && renderCommentBox;

  return (
    <>
      <Translation
        translationKey={`web.notifications.${key}`}
        components={{
          actor: renderTriggerName(),
          value: (
            <span className="font-medium text-primary">
              {notificationField === "priority" ? <Translation translationKey={newValue || "none"} /> : value}
            </span>
          ),
          field: (
            <Translation
              translationKey={NOTIFICATION_FIELD_KEYS[notificationField ?? ""] ?? "web.ui.work_item_property"}
            />
          ),
          action: contentDetails?.action,
        }}
      />
      {showCommentBox && (
        <NotificationCommentBox
          newValue={newValue}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      )}
    </>
  );
}
