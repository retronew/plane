/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// assets
import emptyCycle from "@/app/assets/empty-state/cycle.svg?url";
// components
import { EmptyState } from "@/components/common/empty-state";
import { PageHead } from "@/components/core/page-title";
import useCyclesDetails from "@/components/cycles/active-cycle/use-cycles-details";
import { CycleDetailsSidebar } from "@/components/cycles/analytics-sidebar";
import { CycleDetailsPanel } from "@/components/cycles/cycle-details-panel";
import { CycleLayoutRoot } from "@/components/issues/issue-layouts/roots/cycle-layout-root";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
import useLocalStorage from "@/hooks/use-local-storage";
import type { Route } from "./+types/page";
import { translate } from "@plane/i18n";

function CycleDetailPage({ params }: Route.ComponentProps) {
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId, cycleId } = params;
  // store hooks
  const { getCycleById, loader } = useCycle();
  const { getProjectById } = useProject();
  // const { issuesFilter } = useIssues(EIssuesStoreType.CYCLE);
  // hooks
  const { setValue, storedValue } = useLocalStorage("cycle_sidebar_collapsed", false);

  useCyclesDetails({
    workspaceSlug,
    projectId,
    cycleId,
  });
  // derived values
  const isSidebarCollapsed = storedValue === true;
  const cycle = getCycleById(cycleId);
  const project = getProjectById(projectId);
  const pageTitle = project?.name && cycle?.name ? `${project?.name} - ${cycle?.name}` : undefined;

  /**
   * Toggles the sidebar
   */
  const toggleSidebar = () => setValue(!isSidebarCollapsed);

  // const activeLayout = issuesFilter?.issueFilters?.displayFilters?.layout;
  return (
    <>
      <PageHead title={pageTitle} />
      {!cycle && !loader ? (
        <EmptyState
          image={emptyCycle}
          title={translate("web.cycle_does_not_exist")}
          description={translate("web.the_cycle_you_are_looking_for_does_not_exist_or_has_been_del")}
          primaryButton={{
            text: translate("web.view_other_cycles"),
            onClick: () => router.push(`/${workspaceSlug}/projects/${projectId}/cycles`),
          }}
        />
      ) : (
        <>
          <div className="flex h-full w-full">
            <div className="h-full min-w-0 flex-1 overflow-hidden">
              <CycleLayoutRoot />
            </div>
            <CycleDetailsPanel open={!isSidebarCollapsed}>
              <CycleDetailsSidebar
                handleClose={toggleSidebar}
                cycleId={cycleId}
                projectId={projectId}
                workspaceSlug={workspaceSlug}
              />
            </CycleDetailsPanel>
          </div>
        </>
      )}
    </>
  );
}

export default observer(CycleDetailPage);
