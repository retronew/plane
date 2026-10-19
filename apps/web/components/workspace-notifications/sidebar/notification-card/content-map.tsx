/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Translation } from "@plane/i18n";
import type { ReactNode } from "react";
import {
  convertMinutesToHoursMinutesString,
  renderFormattedDate,
  sanitizeCommentForNotification,
  stripAndTruncateHTML,
} from "@plane/utils";

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
