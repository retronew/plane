/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { EStartOfTheWeek } from "@plane/types";
import { translate } from "@plane/i18n";

export const PROFILE_VIEWER_TAB = [
  {
    key: "summary",
    route: "",
    i18n_label: "profile.tabs.summary",
    selected: "/",
  },
];

export const PROFILE_ADMINS_TAB = [
  {
    key: "assigned",
    route: "assigned",
    i18n_label: "profile.tabs.assigned",
    selected: "/assigned/",
  },
  {
    key: "created",
    route: "created",
    i18n_label: "profile.tabs.created",
    selected: "/created/",
  },
  {
    key: "subscribed",
    route: "subscribed",
    i18n_label: "profile.tabs.subscribed",
    selected: "/subscribed/",
  },
  {
    key: "activity",
    route: "activity",
    i18n_label: "profile.tabs.activity",
    selected: "/activity/",
  },
];

export const PREFERENCE_OPTIONS: {
  id: string;
  title: string;
  description: string;
}[] = [
  {
    id: "theme",
    title: "theme",
    description: "select_or_customize_your_interface_color_scheme",
  },
];

/**
 * @description The options for the start of the week
 * @type {Array<{value: EStartOfTheWeek, label: string}>}
 * @constant
 */
export const START_OF_THE_WEEK_OPTIONS = [
  {
    value: EStartOfTheWeek.SUNDAY,
    get label() {
      return translate("web.sunday");
    },
  },
  {
    value: EStartOfTheWeek.MONDAY,
    get label() {
      return translate("web.monday");
    },
  },
  {
    value: EStartOfTheWeek.TUESDAY,
    get label() {
      return translate("web.tuesday");
    },
  },
  {
    value: EStartOfTheWeek.WEDNESDAY,
    get label() {
      return translate("web.wednesday");
    },
  },
  {
    value: EStartOfTheWeek.THURSDAY,
    get label() {
      return translate("web.thursday");
    },
  },
  {
    value: EStartOfTheWeek.FRIDAY,
    get label() {
      return translate("web.friday");
    },
  },
  {
    value: EStartOfTheWeek.SATURDAY,
    get label() {
      return translate("web.saturday");
    },
  },
];
