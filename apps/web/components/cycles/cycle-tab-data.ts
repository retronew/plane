/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ICycle } from "@plane/types";
import type { ICycleStore } from "@/store/cycle.store";
import type { CycleTab } from "./tab-navigation";

export function isCycleInTab(cycle: Pick<ICycle, "status"> | null | undefined, tab: CycleTab) {
  const status = cycle?.status?.toLowerCase();
  if (tab === "active") return status === "current";
  if (tab === "upcoming") return status === "upcoming" || status === "draft";
  return status === "completed";
}

export function getFilteredCycleIdsForTab(
  store: Pick<ICycleStore, "getFilteredCycleIds" | "getFilteredCompletedCycleIds" | "getCycleById">,
  projectId: string,
  tab: CycleTab
) {
  const ids =
    tab === "completed" ? store.getFilteredCompletedCycleIds(projectId) : store.getFilteredCycleIds(projectId, false);
  return ids?.filter((id) => isCycleInTab(store.getCycleById(id), tab)) ?? null;
}
