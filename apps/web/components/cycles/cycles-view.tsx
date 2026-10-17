/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { calculateTotalFilters } from "@plane/utils";
import { CyclesList } from "@/components/cycles/list";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
import { useCycle } from "@/hooks/store/use-cycle";
import { useCycleFilter } from "@/hooks/store/use-cycle-filter";
import type { CycleTab } from "./tab-navigation";
import { CycleTabEmptyState } from "./tab-empty-state";
import { getFilteredCycleIdsForTab } from "./cycle-tab-data";

export interface ICyclesView {
  workspaceSlug: string;
  projectId: string;
  tab: CycleTab;
}

export const CyclesView = observer(function CyclesView({ workspaceSlug, projectId, tab }: ICyclesView) {
  const cycleStore = useCycle();
  const { searchQuery, currentProjectFilters } = useCycleFilter();
  const cycleIds = getFilteredCycleIdsForTab(cycleStore, projectId, tab);
  if (cycleStore.loader || !cycleIds) return <CycleModuleListLayoutLoader />;
  if (!cycleIds.length)
    return (
      <CycleTabEmptyState
        tab={tab}
        hasSearch={searchQuery.trim() !== ""}
        hasFilters={calculateTotalFilters(currentProjectFilters ?? {}) > 0}
      />
    );
  return <CyclesList cycleIds={cycleIds} workspaceSlug={workspaceSlug} projectId={projectId} tab={tab} />;
});
