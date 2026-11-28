/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { EIssueLayoutTypes } from "@plane/types";

type TLayoutCacheScope = "project" | "project-view" | "workspace-view";

const CACHE_PREFIX = "plane_layout_cache_v1:";
const VALID_LAYOUTS = new Set<string>(Object.values(EIssueLayoutTypes));

const getCacheKey = (scope: TLayoutCacheScope, workspaceSlug: string, entityId: string) =>
  `${CACHE_PREFIX}${scope}:${workspaceSlug}:${entityId}`;

export function readCachedIssueLayout(
  scope: TLayoutCacheScope,
  workspaceSlug?: string,
  entityId?: string
): EIssueLayoutTypes | undefined {
  if (!workspaceSlug || !entityId || typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(getCacheKey(scope, workspaceSlug, entityId));
    if (raw && VALID_LAYOUTS.has(raw)) return raw as EIssueLayoutTypes;
  } catch {
    // Ignore storage access errors in private mode or test runtimes
  }
  return undefined;
}

export function writeCachedIssueLayout(
  scope: TLayoutCacheScope,
  workspaceSlug?: string,
  entityId?: string,
  layout?: EIssueLayoutTypes
): void {
  if (!workspaceSlug || !entityId || !layout || !VALID_LAYOUTS.has(layout) || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getCacheKey(scope, workspaceSlug, entityId), layout);
  } catch {
    // Ignore storage quota or private-mode errors
  }
}
