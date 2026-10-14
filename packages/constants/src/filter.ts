/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { translate } from "@plane/i18n";

export enum E_SORT_ORDER {
  ASC = "asc",
  DESC = "desc",
}
export const DATE_AFTER_FILTER_OPTIONS = [
  {
    get name() {
      return translate("web.runtime.weeks_from_now", { count: 1 });
    },
    value: "1_weeks;after;fromnow",
  },
  {
    get name() {
      return translate("web.runtime.weeks_from_now", { count: 2 });
    },
    value: "2_weeks;after;fromnow",
  },
  {
    get name() {
      return translate("web.runtime.months_from_now", { count: 1 });
    },
    value: "1_months;after;fromnow",
  },
  {
    get name() {
      return translate("web.runtime.months_from_now", { count: 2 });
    },
    value: "2_months;after;fromnow",
  },
];

export const DATE_BEFORE_FILTER_OPTIONS = [
  {
    get name() {
      return translate("web.runtime.weeks_ago", { count: 1 });
    },
    value: "1_weeks;before;fromnow",
  },
  {
    get name() {
      return translate("web.runtime.weeks_ago", { count: 2 });
    },
    value: "2_weeks;before;fromnow",
  },
  {
    get name() {
      return translate("web.runtime.months_ago", { count: 1 });
    },
    i18n_name: "date_filters.1_month_ago",
    value: "1_months;before;fromnow",
  },
];

export const PROJECT_CREATED_AT_FILTER_OPTIONS = [
  {
    get name() {
      return translate("web.runtime.today");
    },
    value: "today;custom;custom",
  },
  {
    get name() {
      return translate("web.runtime.yesterday");
    },
    value: "yesterday;custom;custom",
  },
  {
    get name() {
      return translate("web.runtime.last_7_days");
    },
    value: "last_7_days;custom;custom",
  },
  {
    get name() {
      return translate("web.runtime.last_30_days");
    },
    value: "last_30_days;custom;custom",
  },
];
