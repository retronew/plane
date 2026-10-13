/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TCalendarLayouts } from "@plane/types";
import { EStartOfTheWeek } from "@plane/types";
import { translate } from "@plane/i18n";

export const MONTHS_LIST: {
  [monthNumber: number]: {
    shortTitle: string;
    title: string;
  };
} = {
  1: {
    shortTitle: "Jan",
    get title() {
      return translate("web.january");
    },
  },
  2: {
    shortTitle: "Feb",
    get title() {
      return translate("web.february");
    },
  },
  3: {
    shortTitle: "Mar",
    get title() {
      return translate("web.march");
    },
  },
  4: {
    shortTitle: "Apr",
    get title() {
      return translate("web.april");
    },
  },
  5: {
    shortTitle: "May",
    get title() {
      return translate("web.may");
    },
  },
  6: {
    shortTitle: "Jun",
    get title() {
      return translate("web.june");
    },
  },
  7: {
    shortTitle: "Jul",
    get title() {
      return translate("web.july");
    },
  },
  8: {
    shortTitle: "Aug",
    get title() {
      return translate("web.august");
    },
  },
  9: {
    shortTitle: "Sep",
    get title() {
      return translate("web.september");
    },
  },
  10: {
    shortTitle: "Oct",
    get title() {
      return translate("web.october");
    },
  },
  11: {
    shortTitle: "Nov",
    get title() {
      return translate("web.november");
    },
  },
  12: {
    shortTitle: "Dec",
    get title() {
      return translate("web.december");
    },
  },
};

export const DAYS_LIST: {
  [dayIndex: number]: {
    shortTitle: string;
    title: string;
    value: EStartOfTheWeek;
  };
} = {
  1: {
    shortTitle: "Sun",
    get title() {
      return translate("web.sunday");
    },
    value: EStartOfTheWeek.SUNDAY,
  },
  2: {
    shortTitle: "Mon",
    get title() {
      return translate("web.monday");
    },
    value: EStartOfTheWeek.MONDAY,
  },
  3: {
    shortTitle: "Tue",
    get title() {
      return translate("web.tuesday");
    },
    value: EStartOfTheWeek.TUESDAY,
  },
  4: {
    shortTitle: "Wed",
    get title() {
      return translate("web.wednesday");
    },
    value: EStartOfTheWeek.WEDNESDAY,
  },
  5: {
    shortTitle: "Thu",
    get title() {
      return translate("web.thursday");
    },
    value: EStartOfTheWeek.THURSDAY,
  },
  6: {
    shortTitle: "Fri",
    get title() {
      return translate("web.friday");
    },
    value: EStartOfTheWeek.FRIDAY,
  },
  7: {
    shortTitle: "Sat",
    get title() {
      return translate("web.saturday");
    },
    value: EStartOfTheWeek.SATURDAY,
  },
};

export const CALENDAR_LAYOUTS: {
  [layout in TCalendarLayouts]: {
    key: TCalendarLayouts;
    title: string;
  };
} = {
  month: {
    key: "month",
    get title() {
      return translate("web.month_layout");
    },
  },
  week: {
    key: "week",
    get title() {
      return translate("web.week_layout");
    },
  },
};
