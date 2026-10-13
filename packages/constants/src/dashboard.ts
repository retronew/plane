/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// types
import type { TIssuesListTypes } from "@plane/types";
import { translate } from "@plane/i18n";

export enum EDurationFilters {
  NONE = "none",
  TODAY = "today",
  THIS_WEEK = "this_week",
  THIS_MONTH = "this_month",
  THIS_YEAR = "this_year",
  CUSTOM = "custom",
}

// filter duration options
export const DURATION_FILTER_OPTIONS: {
  key: EDurationFilters;
  label: string;
}[] = [
  {
    key: EDurationFilters.NONE,
    get label() {
      return translate("web.all_time");
    },
  },
  {
    key: EDurationFilters.TODAY,
    get label() {
      return translate("web.due_today");
    },
  },
  {
    key: EDurationFilters.THIS_WEEK,
    get label() {
      return translate("web.due_this_week");
    },
  },
  {
    key: EDurationFilters.THIS_MONTH,
    get label() {
      return translate("web.due_this_month");
    },
  },
  {
    key: EDurationFilters.THIS_YEAR,
    get label() {
      return translate("web.due_this_year");
    },
  },
  {
    key: EDurationFilters.CUSTOM,
    get label() {
      return translate("web.custom");
    },
  },
];

// random background colors for project cards
export const PROJECT_BACKGROUND_COLORS = [
  "bg-gray-500/20",
  "bg-success-subtle",
  "bg-danger-subtle",
  "bg-orange-500/20",
  "bg-blue-500/20",
  "bg-yellow-500/20",
  "bg-pink-500/20",
  "bg-purple-500/20",
];

// assigned and created issues widgets tabs list
export const FILTERED_ISSUES_TABS_LIST: {
  key: TIssuesListTypes;
  label: string;
}[] = [
  {
    key: "upcoming",
    get label() {
      return translate("web.upcoming");
    },
  },
  {
    key: "overdue",
    get label() {
      return translate("web.overdue");
    },
  },
  {
    key: "completed",
    get label() {
      return translate("web.marked_completed");
    },
  },
];

// assigned and created issues widgets tabs list
export const UNFILTERED_ISSUES_TABS_LIST: {
  key: TIssuesListTypes;
  label: string;
}[] = [
  {
    key: "pending",
    get label() {
      return translate("web.pending");
    },
  },
  {
    key: "completed",
    get label() {
      return translate("web.marked_completed");
    },
  },
];

export type TLinkOptions = {
  userId: string | undefined;
};
