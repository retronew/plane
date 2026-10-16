/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Insights } from "./insights";
import type { AnalyticsTab } from "@plane/types";
import { Overview } from "@/components/analytics/overview";
import { WorkItems } from "@/components/analytics/work-items";

import { ProjectsAnalytics, UsersAnalytics, CyclesAnalytics, ModulesAnalytics, IntakeAnalytics } from "./details";

export const getAnalyticsTabs = (t: (key: string, params?: Record<string, any>) => string): AnalyticsTab[] => [
  { key: "overview", label: t("common.overview"), content: Overview, isDisabled: false },
  {
    key: "projects",
    label: t("workspace_analytics.details.tabs.projects"),
    content: ProjectsAnalytics,
    isDisabled: false,
  },
  { key: "users", label: t("workspace_analytics.details.tabs.users"), content: UsersAnalytics, isDisabled: false },
  { key: "work-items", label: t("sidebar.work_items"), content: WorkItems, isDisabled: false },
  { key: "cycles", label: t("workspace_analytics.details.tabs.cycles"), content: CyclesAnalytics, isDisabled: false },
  {
    key: "modules",
    label: t("workspace_analytics.details.tabs.modules"),
    content: ModulesAnalytics,
    isDisabled: false,
  },
  { key: "insights", label: t("workspace_analytics.insights.title"), content: Insights, isDisabled: false },
  { key: "intake", label: t("workspace_analytics.details.tabs.intake"), content: IntakeAnalytics, isDisabled: false },
];
