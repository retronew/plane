/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TAnalyticsTabsBase } from "@plane/types";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
import { translate } from "@plane/i18n";

export interface IInsightField {
  key: string;
  i18nKey: string;
  i18nProps?: {
    entity?: string;
    entityPlural?: string;
    prefix?: string;
    suffix?: string;
    [key: string]: unknown;
  };
}

export const ANALYTICS_INSIGHTS_FIELDS: Record<TAnalyticsTabsBase, IInsightField[]> = {
  overview: [
    {
      key: "total_users",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.users",
      },
    },
    {
      key: "total_admins",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.admins",
      },
    },
    {
      key: "total_members",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.members",
      },
    },
    {
      key: "total_guests",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.guests",
      },
    },
    {
      key: "total_projects",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.projects",
      },
    },
    {
      key: "total_work_items",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.work_items",
      },
    },
    {
      key: "total_cycles",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.cycles",
      },
    },
    {
      key: "total_intake",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "sidebar.intake",
      },
    },
  ],
  "work-items": [
    {
      key: "total_work_items",
      i18nKey: "workspace_analytics.total",
    },
    {
      key: "started_work_items",
      i18nKey: "workspace_analytics.started_work_items",
    },
    {
      key: "backlog_work_items",
      i18nKey: "workspace_analytics.backlog_work_items",
    },
    {
      key: "un_started_work_items",
      i18nKey: "workspace_analytics.un_started_work_items",
    },
    {
      key: "completed_work_items",
      i18nKey: "workspace_analytics.completed_work_items",
    },
  ],
};

export const ANALYTICS_DURATION_FILTER_OPTIONS = [
  {
    get name() {
      return translate("workspace_analytics.dashboard.all_time");
    },
    value: "all_time",
  },
  {
    get name() {
      return translate("web.runtime.yesterday");
    },
    value: "yesterday",
  },
  {
    get name() {
      return translate("web.runtime.last_7_days");
    },
    value: "last_7_days",
  },
  {
    get name() {
      return translate("web.runtime.last_30_days");
    },
    value: "last_30_days",
  },
  {
    get name() {
      return translate("web.runtime.last_3_months");
    },
    value: "last_3_months",
  },
];

export const ANALYTICS_X_AXIS_VALUES: { value: ChartXAxisProperty; label: string }[] = [
  {
    value: ChartXAxisProperty.PROJECTS,
    get label() {
      return translate("workspace_analytics.details.tabs.projects");
    },
  },
  {
    value: ChartXAxisProperty.CREATED_BY,
    get label() {
      return translate("workspace_analytics.insights.created_by");
    },
  },
  {
    value: ChartXAxisProperty.STATES,
    get label() {
      return translate("web.state_name");
    },
  },
  {
    value: ChartXAxisProperty.STATE_GROUPS,
    get label() {
      return translate("web.state_group");
    },
  },
  {
    value: ChartXAxisProperty.PRIORITY,
    get label() {
      return translate("web.priority");
    },
  },
  {
    value: ChartXAxisProperty.LABELS,
    get label() {
      return translate("web.label");
    },
  },
  {
    value: ChartXAxisProperty.ASSIGNEES,
    get label() {
      return translate("web.assignee");
    },
  },
  {
    value: ChartXAxisProperty.ESTIMATE_POINTS,
    get label() {
      return translate("web.estimate_point");
    },
  },
  {
    value: ChartXAxisProperty.CYCLES,
    get label() {
      return translate("web.cycle");
    },
  },
  {
    value: ChartXAxisProperty.MODULES,
    get label() {
      return translate("web.module");
    },
  },
  {
    value: ChartXAxisProperty.COMPLETED_AT,
    get label() {
      return translate("web.completed_date");
    },
  },
  {
    value: ChartXAxisProperty.TARGET_DATE,
    get label() {
      return translate("web.due_date");
    },
  },
  {
    value: ChartXAxisProperty.START_DATE,
    get label() {
      return translate("web.start_date");
    },
  },
  {
    value: ChartXAxisProperty.CREATED_AT,
    get label() {
      return translate("web.created_date");
    },
  },
];

export const ANALYTICS_Y_AXIS_VALUES: { value: ChartYAxisMetric; label: string }[] = [
  {
    value: ChartYAxisMetric.WORK_ITEM_COUNT,
    get label() {
      return translate("web.work_item");
    },
  },
  {
    value: ChartYAxisMetric.ESTIMATE_POINT_COUNT,
    get label() {
      return translate("web.estimate");
    },
  },
  {
    value: ChartYAxisMetric.EPIC_WORK_ITEM_COUNT,
    get label() {
      return translate("web.epic");
    },
  },
];

export const ANALYTICS_V2_DATE_KEYS = ["completed_at", "target_date", "start_date", "created_at"];
