/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import type {
  CompactAssetType,
  DetailedAssetType,
  HorizontalStackAssetType,
  IllustrationAssetType,
  VerticalStackAssetType,
} from "./asset-types";

type IllustrationComponent = React.ComponentType<{ className?: string }>;
type LazyIllustration = React.LazyExoticComponent<IllustrationComponent>;

/**
 * Wraps a named-export illustration module in a `React.lazy` boundary.
 *
 * Each illustration is heavy (full inline SVG markup), and the registries below reference ~50 of
 * them. Importing the registry statically would pull every illustration into whichever chunk an
 * empty-state component lands in, even though a given empty state renders exactly one. Lazily
 * importing each illustration keeps them in their own on-demand chunks so only the rendered asset
 * is fetched. The `loader` specifier MUST stay a string literal so the bundler can code-split it.
 */
const lazyIllustration = (
  loader: () => Promise<Record<string, IllustrationComponent>>,
  exportName: string
): LazyIllustration =>
  React.lazy(async () => {
    const module = await loader();
    const Illustration = module?.[exportName];
    // A missing module or export means the illustration chunk resolved to nothing (stale deploy,
    // blocked request). These assets are purely decorative, so degrade to rendering nothing rather
    // than letting React.lazy reject and tear down the empty state — and the page — around it.
    if (!Illustration) {
      console.error(`[EmptyState] Illustration "${exportName}" failed to resolve from its chunk.`);
      return { default: (() => null) as IllustrationComponent };
    }
    return { default: Illustration };
  });

// Horizontal Stack Asset Registry
export const HORIZONTAL_STACK_ASSETS: Record<HorizontalStackAssetType, LazyIllustration> = {
  customer: lazyIllustration(() => import("./horizontal-stack/customer"), "CustomerHorizontalStackIllustration"),
  estimate: lazyIllustration(() => import("./horizontal-stack/estimate"), "EstimateHorizontalStackIllustration"),
  export: lazyIllustration(() => import("./horizontal-stack/export"), "ExportHorizontalStackIllustration"),
  intake: lazyIllustration(() => import("./horizontal-stack/intake"), "IntakeHorizontalStackIllustration"),
  label: lazyIllustration(() => import("./horizontal-stack/label"), "LabelHorizontalStackIllustration"),
  link: lazyIllustration(() => import("./horizontal-stack/link"), "LinkHorizontalStackIllustration"),
  members: lazyIllustration(() => import("./horizontal-stack/members"), "MembersHorizontalStackIllustration"),
  note: lazyIllustration(() => import("./horizontal-stack/note"), "NoteHorizontalStackIllustration"),
  page: lazyIllustration(() => import("./horizontal-stack/page"), "PageHorizontalStackIllustration"),
  priority: lazyIllustration(() => import("./horizontal-stack/priority"), "PriorityHorizontalStackIllustration"),
  project: lazyIllustration(() => import("./horizontal-stack/project"), "ProjectHorizontalStackIllustration"),
  "search-compact": lazyIllustration(() => import("./horizontal-stack/search"), "SearchHorizontalStackIllustration"),
  settings: lazyIllustration(() => import("./horizontal-stack/settings"), "SettingsHorizontalStackIllustration"),
  script: lazyIllustration(() => import("./horizontal-stack/script"), "ScriptHorizontalStackIllustration"),
  state: lazyIllustration(() => import("./horizontal-stack/state"), "StateHorizontalStackIllustration"),
  "state-square": lazyIllustration(
    () => import("./horizontal-stack/state-square"),
    "StateSquareHorizontalStackIllustration"
  ),
  template: lazyIllustration(() => import("./horizontal-stack/template"), "TemplateHorizontalStackIllustration"),
  token: lazyIllustration(() => import("./horizontal-stack/token"), "TokenHorizontalStackIllustration"),
  unknown: lazyIllustration(() => import("./horizontal-stack/unknown"), "UnknownHorizontalStackIllustration"),
  update: lazyIllustration(() => import("./horizontal-stack/update"), "UpdateHorizontalStackIllustration"),
  webhook: lazyIllustration(() => import("./horizontal-stack/webhook"), "WebhookHorizontalStackIllustration"),
  "work-item": lazyIllustration(() => import("./horizontal-stack/work-item"), "WorkItemHorizontalStackIllustration"),
  worklog: lazyIllustration(() => import("./horizontal-stack/worklog"), "WorklogHorizontalStackIllustration"),
  workflow: lazyIllustration(() => import("./horizontal-stack/workflow"), "WorkflowHorizontalStackIllustration"),
  "group-syncing": lazyIllustration(
    () => import("./horizontal-stack/group-syncing"),
    "GroupSyncingHorizontalStackIllustration"
  ),
  "runner-scripts": lazyIllustration(
    () => import("./horizontal-stack/runner-scripts"),
    "RunnerScriptsHorizontalStackIllustration"
  ),
  "runner-functions": lazyIllustration(
    () => import("./horizontal-stack/runner-functions"),
    "RunnerFunctionsHorizontalStackIllustration"
  ),
  "custom-properties": lazyIllustration(
    () => import("./horizontal-stack/custom-properties"),
    "CustomPropertiesHorizontalStackIllustration"
  ),
  "ai-skills": lazyIllustration(() => import("./horizontal-stack/ai-skills"), "AiSkillsHorizontalStackIllustration"),
  "ai-agents": lazyIllustration(() => import("./horizontal-stack/ai-agents"), "AiAgentsHorizontalStackIllustration"),
  memory: lazyIllustration(() => import("./horizontal-stack/memory"), "MemoryHorizontalStackIllustration"),
};

// Vertical Stack Asset Registry
export const VERTICAL_STACK_ASSETS: Record<VerticalStackAssetType, LazyIllustration> = {
  "archived-cycle": lazyIllustration(
    () => import("./vertical-stack/archived-cycle"),
    "ArchivedCycleVerticalStackIllustration"
  ),
  "archived-module": lazyIllustration(
    () => import("./vertical-stack/archived-module"),
    "ArchivedModuleVerticalStackIllustration"
  ),
  "archived-work-item": lazyIllustration(
    () => import("./vertical-stack/archived-work-item"),
    "ArchivedWorkItemVerticalStackIllustration"
  ),
  changelog: lazyIllustration(() => import("./vertical-stack/changelog"), "ChangelogVerticalStackIllustration"),
  customer: lazyIllustration(() => import("./vertical-stack/customer"), "CustomerVerticalStackIllustration"),
  cycle: lazyIllustration(() => import("./vertical-stack/cycle"), "CycleVerticalStackIllustration"),
  dashboard: lazyIllustration(() => import("./vertical-stack/dashboard"), "DashboardVerticalStackIllustration"),
  draft: lazyIllustration(() => import("./vertical-stack/draft"), "DraftVerticalStackIllustration"),
  "error-404": lazyIllustration(() => import("./vertical-stack/404-error"), "Error404VerticalStackIllustration"),
  inbox: lazyIllustration(() => import("./vertical-stack/inbox"), "InboxVerticalStackIllustration"),
  initiative: lazyIllustration(() => import("./vertical-stack/initiative"), "InitiativeVerticalStackIllustration"),
  intake: lazyIllustration(() => import("./vertical-stack/intake"), "IntakeVerticalStackIllustration"),
  "invalid-link": lazyIllustration(
    () => import("./vertical-stack/invalid-link"),
    "InvalidLinkVerticalStackIllustration"
  ),
  milestone: lazyIllustration(() => import("./vertical-stack/milestone"), "MilestoneVerticalStackIllustration"),
  module: lazyIllustration(() => import("./vertical-stack/module"), "ModuleVerticalStackIllustration"),
  "no-access": lazyIllustration(() => import("./vertical-stack/no-access"), "NoAccessVerticalStackIllustration"),
  page: lazyIllustration(() => import("./vertical-stack/page"), "PageVerticalStackIllustration"),
  property: lazyIllustration(() => import("./vertical-stack/property"), "PropertyVerticalStackIllustration"),
  project: lazyIllustration(() => import("./vertical-stack/project"), "ProjectVerticalStackIllustration"),
  "server-error": lazyIllustration(
    () => import("./vertical-stack/server-error"),
    "ServerErrorVerticalStackIllustration"
  ),
  stickies: lazyIllustration(() => import("./vertical-stack/stickies"), "StickiesVerticalStackIllustration"),
  teamspace: lazyIllustration(() => import("./vertical-stack/teamspace"), "TeamspaceVerticalStackIllustration"),
  view: lazyIllustration(() => import("./vertical-stack/view"), "ViewVerticalStackIllustration"),
  "work-item": lazyIllustration(() => import("./vertical-stack/work-item"), "WorkItemVerticalStackIllustration"),
  workflow: lazyIllustration(() => import("./vertical-stack/workflow"), "WorkflowVerticalStackIllustration"),
};

// Illustration Asset Registry
export const ILLUSTRATION_ASSETS: Record<IllustrationAssetType, LazyIllustration> = {
  inbox: lazyIllustration(() => import("./illustration/inbox"), "InboxIllustration"),
  search: lazyIllustration(() => import("./illustration/search"), "SearchIllustration"),
};

export type AssetDimensions = {
  width: number;
  height: number;
};

const HORIZONTAL_STACK_DIMENSIONS: Record<HorizontalStackAssetType, AssetDimensions> = {
  "ai-agents": { width: 72, height: 81 },
  "ai-skills": { width: 72, height: 81 },
  "custom-properties": { width: 72, height: 81 },
  customer: { width: 81, height: 91 },
  estimate: { width: 81, height: 92 },
  export: { width: 71, height: 80 },
  "group-syncing": { width: 69, height: 78 },
  intake: { width: 71, height: 80 },
  label: { width: 81, height: 92 },
  link: { width: 51, height: 58 },
  members: { width: 71, height: 80 },
  memory: { width: 72, height: 81 },
  note: { width: 51, height: 58 },
  page: { width: 71, height: 80 },
  priority: { width: 71, height: 80 },
  project: { width: 102, height: 115 },
  "runner-functions": { width: 72, height: 80 },
  "runner-scripts": { width: 72, height: 80 },
  script: { width: 72, height: 81 },
  "search-compact": { width: 72, height: 81 },
  settings: { width: 71, height: 80 },
  "state-square": { width: 70, height: 79 },
  state: { width: 72, height: 81 },
  template: { width: 81, height: 92 },
  token: { width: 81, height: 92 },
  unknown: { width: 71, height: 80 },
  update: { width: 72, height: 81 },
  webhook: { width: 81, height: 91 },
  "work-item": { width: 71, height: 80 },
  workflow: { width: 72, height: 81 },
  worklog: { width: 81, height: 91 },
};

const VERTICAL_STACK_DIMENSIONS: Record<VerticalStackAssetType, AssetDimensions> = {
  "archived-cycle": { width: 161, height: 174 },
  "archived-module": { width: 161, height: 182 },
  "archived-work-item": { width: 161, height: 176 },
  changelog: { width: 162, height: 172 },
  customer: { width: 162, height: 171 },
  cycle: { width: 160, height: 165 },
  dashboard: { width: 160, height: 164 },
  draft: { width: 162, height: 175 },
  "error-404": { width: 161, height: 173 },
  inbox: { width: 151, height: 167 },
  initiative: { width: 162, height: 171 },
  intake: { width: 150, height: 171 },
  "invalid-link": { width: 161, height: 151 },
  milestone: { width: 155, height: 164 },
  module: { width: 162, height: 168 },
  "no-access": { width: 161, height: 169 },
  page: { width: 162, height: 177 },
  project: { width: 160, height: 143 },
  property: { width: 161, height: 169 },
  "server-error": { width: 162, height: 184 },
  stickies: { width: 160, height: 186 },
  teamspace: { width: 162, height: 188 },
  view: { width: 162, height: 163 },
  "work-item": { width: 162, height: 180 },
  workflow: { width: 227, height: 240 },
};

const ILLUSTRATION_DIMENSIONS: Record<IllustrationAssetType, AssetDimensions> = {
  inbox: { width: 100, height: 92 },
  search: { width: 161, height: 168 },
};

const DEFAULT_COMPACT_DIMENSIONS: AssetDimensions = { width: 72, height: 81 };
const DEFAULT_DETAILED_DIMENSIONS: AssetDimensions = { width: 160, height: 168 };

export const getCompactAssetDimensions = (assetKey?: CompactAssetType): AssetDimensions => {
  if (!assetKey) return DEFAULT_COMPACT_DIMENSIONS;
  return (
    HORIZONTAL_STACK_DIMENSIONS[assetKey as HorizontalStackAssetType] ??
    ILLUSTRATION_DIMENSIONS[assetKey as IllustrationAssetType] ??
    DEFAULT_COMPACT_DIMENSIONS
  );
};

export const getDetailedAssetDimensions = (assetKey?: DetailedAssetType): AssetDimensions => {
  if (!assetKey) return DEFAULT_DETAILED_DIMENSIONS;
  return (
    VERTICAL_STACK_DIMENSIONS[assetKey as VerticalStackAssetType] ??
    ILLUSTRATION_DIMENSIONS[assetKey as IllustrationAssetType] ??
    DEFAULT_DETAILED_DIMENSIONS
  );
};

// Helper functions to get assets
export const getCompactAsset = (assetKey: CompactAssetType, className?: string): React.ReactNode => {
  const AssetComponent =
    HORIZONTAL_STACK_ASSETS[assetKey as HorizontalStackAssetType] ||
    ILLUSTRATION_ASSETS[assetKey as IllustrationAssetType];

  if (!AssetComponent) {
    console.warn(`Asset "${assetKey}" not found in compact asset registry`);
    return null;
  }

  return <AssetComponent className={className} />;
};

export const getDetailedAsset = (assetKey: DetailedAssetType, className?: string): React.ReactNode => {
  const AssetComponent =
    VERTICAL_STACK_ASSETS[assetKey as VerticalStackAssetType] || ILLUSTRATION_ASSETS[assetKey as IllustrationAssetType];

  if (!AssetComponent) {
    console.warn(`Asset "${assetKey}" not found in detailed asset registry`);
    return null;
  }

  return <AssetComponent className={className} />;
};
