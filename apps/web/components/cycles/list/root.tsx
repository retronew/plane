/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ContentWrapper, ERowVariant } from "@plane/blocks/layout";
import { ListLayout } from "@/components/core/list";
import { ProjectActiveCycle } from "../active-cycle/project-active-cycle";
import { CyclePeekOverview } from "../cycle-peek-overview";
import type { CycleTab } from "../tab-navigation";
import { CyclesListMap } from "./cycles-list-map";

export interface ICyclesList {
  completedCycleIds?: string[];
  upcomingCycleIds?: string[];
  cycleIds: string[];
  workspaceSlug: string;
  projectId: string;
  isArchived?: boolean;
  tab?: CycleTab;
}

export const CyclesList = observer(function CyclesList({
  cycleIds,
  workspaceSlug,
  projectId,
  isArchived = false,
  tab = "active",
}: ICyclesList) {
  return (
    <ContentWrapper variant={ERowVariant.HUGGING} className="min-h-0 flex-row">
      {tab === "active" && !isArchived ? (
        <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
          {cycleIds.map((cycleId) => (
            <ProjectActiveCycle key={cycleId} cycleId={cycleId} projectId={projectId} workspaceSlug={workspaceSlug} />
          ))}
        </div>
      ) : (
        <ListLayout>
          <CyclesListMap cycleIds={cycleIds} projectId={projectId} workspaceSlug={workspaceSlug} />
        </ListLayout>
      )}
      <CyclePeekOverview projectId={projectId} workspaceSlug={workspaceSlug} isArchived={isArchived} />
    </ContentWrapper>
  );
});
