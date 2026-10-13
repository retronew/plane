/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TStateGroups } from "@plane/types";
import { translate } from "@plane/i18n";

export type TDraggableData = {
  groupKey: TStateGroups;
  id: string;
};

export const STATE_GROUPS: {
  [key in TStateGroups]: {
    key: TStateGroups;
    label: string;
    defaultStateName: string;
    color: string;
  };
} = {
  backlog: {
    key: "backlog",
    get label() {
      return translate("web.backlog");
    },
    defaultStateName: "Backlog",
    color: "#d9d9d9",
  },
  unstarted: {
    key: "unstarted",
    get label() {
      return translate("web.unstarted");
    },
    defaultStateName: "Todo",
    color: "#3f76ff",
  },
  started: {
    key: "started",
    get label() {
      return translate("web.started");
    },
    defaultStateName: "In Progress",
    color: "#f59e0b",
  },
  completed: {
    key: "completed",
    get label() {
      return translate("web.completed");
    },
    defaultStateName: "Done",
    color: "#16a34a",
  },
  cancelled: {
    key: "cancelled",
    get label() {
      return translate("web.canceled");
    },
    defaultStateName: "Cancelled",
    color: "#dc2626",
  },
};

export const ARCHIVABLE_STATE_GROUPS = [STATE_GROUPS.completed.key, STATE_GROUPS.cancelled.key];
export const COMPLETED_STATE_GROUPS = [STATE_GROUPS.completed.key];
export const PENDING_STATE_GROUPS = [
  STATE_GROUPS.backlog.key,
  STATE_GROUPS.unstarted.key,
  STATE_GROUPS.started.key,
  STATE_GROUPS.cancelled.key,
];

export const STATE_DISTRIBUTION = {
  [STATE_GROUPS.backlog.key]: {
    key: STATE_GROUPS.backlog.key,
    issues: "backlog_issues",
    points: "backlog_estimate_points",
  },
  [STATE_GROUPS.unstarted.key]: {
    key: STATE_GROUPS.unstarted.key,
    issues: "unstarted_issues",
    points: "unstarted_estimate_points",
  },
  [STATE_GROUPS.started.key]: {
    key: STATE_GROUPS.started.key,
    issues: "started_issues",
    points: "started_estimate_points",
  },
  [STATE_GROUPS.completed.key]: {
    key: STATE_GROUPS.completed.key,
    issues: "completed_issues",
    points: "completed_estimate_points",
  },
  [STATE_GROUPS.cancelled.key]: {
    key: STATE_GROUPS.cancelled.key,
    issues: "cancelled_issues",
    points: "cancelled_estimate_points",
  },
};

export const PROGRESS_STATE_GROUPS_DETAILS = [
  {
    key: "completed_issues",
    get title() {
      return translate("web.completed");
    },
    color: "#16A34A",
  },
  {
    key: "started_issues",
    get title() {
      return translate("web.started");
    },
    color: "#F59E0B",
  },
  {
    key: "unstarted_issues",
    get title() {
      return translate("web.unstarted");
    },
    color: "#3A3A3A",
  },
  {
    key: "backlog_issues",
    get title() {
      return translate("web.backlog");
    },
    color: "#A3A3A3",
  },
];

export const DISPLAY_WORKFLOW_PRO_CTA = false;
