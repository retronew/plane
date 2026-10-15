/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TChartColorScheme } from "@plane/types";
import { ChartXAxisProperty } from "@plane/types";

export const LABEL_CLASSNAME = "fill-secondary text-11";
export const AXIS_LABEL_CLASSNAME = "fill-secondary text-11";

export enum ChartXAxisDateGrouping {
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
  YEAR = "YEAR",
}

export const TO_CAPITALIZE_PROPERTIES: ChartXAxisProperty[] = [
  ChartXAxisProperty.PRIORITY,
  ChartXAxisProperty.STATE_GROUPS,
];

export const CHART_X_AXIS_DATE_PROPERTIES: ChartXAxisProperty[] = [
  ChartXAxisProperty.START_DATE,
  ChartXAxisProperty.TARGET_DATE,
  ChartXAxisProperty.CREATED_AT,
  ChartXAxisProperty.COMPLETED_AT,
];

export enum EChartModels {
  BASIC = "BASIC",
  STACKED = "STACKED",
  GROUPED = "GROUPED",
  MULTI_LINE = "MULTI_LINE",
  COMPARISON = "COMPARISON",
  PROGRESS = "PROGRESS",
}

/** Apple HIG system color specifications, verified 2026-10-16.
 * https://developer.apple.com/design/human-interface-guidelines/color#Specifications
 * Web sRGB equivalents; native Apple colors remain dynamically managed by the OS.
 */
export const APPLE_CHART_COLORS = {
  blue: ["#0088ff", "#0091ff"],
  green: ["#34c759", "#30d158"],
  orange: ["#ff8d28", "#ff9230"],
  red: ["#ff383c", "#ff4245"],
  indigo: ["#6155f5", "#6d7cff"],
  mint: ["#00c8b3", "#00dac3"],
  teal: ["#00c3d0", "#00d2e0"],
  purple: ["#cb30e0", "#db34f2"],
  pink: ["#ff2d55", "#ff375f"],
  gray: ["#8e8e93", "#8e8e93"],
  gray2: ["#aeaeb2", "#636366"],
} as const;
const appleChartColor = (key: keyof typeof APPLE_CHART_COLORS) => {
  const [light, dark] = APPLE_CHART_COLORS[key];
  return `light-dark(${light}, ${dark})`;
};
const appleSeriesOrder = [
  "blue",
  "green",
  "indigo",
  "orange",
  "red",
  "mint",
  "teal",
  "purple",
  "pink",
  "gray",
] as const;

export const CHART_COLOR_PALETTES: {
  key: TChartColorScheme;
  i18n_label: string;
  light: string[];
  dark: string[];
}[] = [
  {
    key: "modern",
    i18n_label: "dashboards.widget.color_palettes.modern",
    light: appleSeriesOrder.map((key) => APPLE_CHART_COLORS[key][0]),
    dark: appleSeriesOrder.map((key) => APPLE_CHART_COLORS[key][1]),
  },
  {
    key: "horizon",
    i18n_label: "dashboards.widget.color_palettes.horizon",
    light: [
      "#E76E50",
      "#289D90",
      "#F3A362",
      "#E9C368",
      "#264753",
      "#8A6FA0",
      "#5B9EE5",
      "#7CC474",
      "#BA7DB5",
      "#CF8640",
    ],
    dark: [
      "#E05A3A",
      "#1D8A7E",
      "#D98B4D",
      "#D1AC50",
      "#3A6B7C",
      "#7D6297",
      "#4D8ACD",
      "#569C64",
      "#C16A8C",
      "#B77436",
    ],
  },
  {
    key: "earthen",
    i18n_label: "dashboards.widget.color_palettes.earthen",
    light: [
      "#386641",
      "#6A994E",
      "#A7C957",
      "#E97F4E",
      "#BC4749",
      "#9E2A2B",
      "#80CED1",
      "#5C3E79",
      "#526EAB",
      "#6B5B95",
    ],
    dark: [
      "#497752",
      "#7BAA5F",
      "#B8DA68",
      "#FA905F",
      "#CD585A",
      "#AF3B3C",
      "#91DFE2",
      "#6D4F8A",
      "#637FBC",
      "#7C6CA6",
    ],
  },
];

/** Chart-only semantic tokens. Do not change user-defined workflow state colors. */
export const CHART_SEMANTIC_COLORS = {
  primary: appleChartColor("blue"),
  completed: appleChartColor("green"),
  warning: appleChartColor("orange"),
  danger: appleChartColor("red"),
  neutral: appleChartColor("gray"),
  cancelled: appleChartColor("gray2"),
  secondary: appleChartColor("indigo"),
} as const;

export const CHART_SERIES_COLORS = [
  CHART_SEMANTIC_COLORS.primary,
  CHART_SEMANTIC_COLORS.completed,
  CHART_SEMANTIC_COLORS.secondary,
  CHART_SEMANTIC_COLORS.warning,
  CHART_SEMANTIC_COLORS.danger,
] as const;

export const CHART_STATE_COLORS = {
  backlog: CHART_SEMANTIC_COLORS.neutral,
  unstarted: CHART_SEMANTIC_COLORS.primary,
  started: CHART_SEMANTIC_COLORS.warning,
  completed: CHART_SEMANTIC_COLORS.completed,
  cancelled: CHART_SEMANTIC_COLORS.cancelled,
} as const;

export const CHART_PRIORITY_COLORS = {
  urgent: CHART_SEMANTIC_COLORS.danger,
  high: CHART_SEMANTIC_COLORS.warning,
  medium: CHART_SEMANTIC_COLORS.primary,
  low: CHART_SEMANTIC_COLORS.completed,
  none: CHART_SEMANTIC_COLORS.neutral,
} as const;
