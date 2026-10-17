/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { usePathname, useSearchParams } from "next/navigation";
// hooks
import { generateQueryParams } from "@plane/utils";
import { useCycle } from "@/hooks/store/use-cycle";
import { useAppRouter } from "@/hooks/use-app-router";
// components
import { CycleDetailsSidebar } from "./analytics-sidebar";
import { CycleDetailsPanel } from "./cycle-details-panel";

type Props = {
  projectId?: string;
  workspaceSlug: string;
  isArchived?: boolean;
};

export const CyclePeekOverview = observer(function CyclePeekOverview(props: Props) {
  const { projectId: propsProjectId, workspaceSlug, isArchived } = props;
  // router
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const peekCycle = searchParams.get("peekCycle");
  // store hooks
  const { getCycleById, fetchCycleDetails, fetchArchivedCycleDetails } = useCycle();
  // derived values
  const cycleDetails = peekCycle ? getCycleById(peekCycle.toString()) : undefined;
  const projectId = propsProjectId || cycleDetails?.project_id;
  const open = !!(peekCycle && projectId);
  // Keep the last open content available while Base UI waits for the exit transition.
  const [retainedPeek, setRetainedPeek] = useState({ cycleId: peekCycle, projectId, workspaceSlug, isArchived });
  if (
    open &&
    (retainedPeek.cycleId !== peekCycle ||
      retainedPeek.projectId !== projectId ||
      retainedPeek.workspaceSlug !== workspaceSlug ||
      retainedPeek.isArchived !== isArchived)
  ) {
    setRetainedPeek({ cycleId: peekCycle, projectId, workspaceSlug, isArchived });
  }
  const visiblePeek = open ? { cycleId: peekCycle, projectId, workspaceSlug, isArchived } : retainedPeek;

  const handleClose = () => {
    const query = generateQueryParams(searchParams, ["peekCycle"]);
    router.push(`${pathname}?${query}`);
  };

  useEffect(() => {
    if (!peekCycle || !projectId) return;
    if (isArchived) fetchArchivedCycleDetails(workspaceSlug, projectId, peekCycle.toString());
    else fetchCycleDetails(workspaceSlug, projectId, peekCycle.toString());
  }, [fetchArchivedCycleDetails, fetchCycleDetails, isArchived, peekCycle, projectId, workspaceSlug]);

  return (
    <CycleDetailsPanel open={open} className="z-[9]">
      {visiblePeek.cycleId && visiblePeek.projectId && (
        <CycleDetailsSidebar
          handleClose={handleClose}
          isArchived={visiblePeek.isArchived}
          projectId={visiblePeek.projectId}
          workspaceSlug={visiblePeek.workspaceSlug}
          cycleId={visiblePeek.cycleId}
        />
      )}
    </CycleDetailsPanel>
  );
});
