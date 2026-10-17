/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Badge } from "@makeplane/propel/components/badge";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { getFilteredCycleIdsForTab, isCycleInTab } from "@/components/cycles/cycle-tab-data";
import { useSearchParams } from "next/navigation";
import { CycleTabNavigation } from "@/components/cycles/tab-navigation";
import { CyclesViewHeader } from "@/components/cycles/cycles-view-header";
// plane imports
import { useTheme } from "next-themes";
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation, translate } from "@plane/i18n";
import type { TCycleFilters } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
// components
import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { calculateTotalFilters } from "@plane/utils";
// assets
import darkEmptyState from "@/app/assets/empty-state/disabled-feature/cycles-dark.webp?url";
import lightEmptyState from "@/app/assets/empty-state/disabled-feature/cycles-light.webp?url";
// components
import { PageHead } from "@/components/core/page-title";
import { CycleAppliedFiltersList } from "@/components/cycles/applied-filters";
import { CyclesView } from "@/components/cycles/cycles-view";
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useCycleFilter } from "@/hooks/store/use-cycle-filter";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { Route } from "./+types/page";

function ProjectCyclesPage({ params }: Route.ComponentProps) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab === "upcoming" || requestedTab === "completed" ? requestedTab : "active";
  // store hooks
  const cycleStore = useCycle();
  const { loader, cycleMap, fetchedMap } = cycleStore;
  const { getProjectById, currentProjectDetails } = useProject();
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = params;
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // cycle filters hook
  const { clearAllFilters, currentProjectFilters, updateFilters, searchQuery } = useCycleFilter();
  const { allowPermissions } = useUserPermissions();
  // derived values
  const resolvedEmptyState = resolvedTheme === "light" ? lightEmptyState : darkEmptyState;
  const project = getProjectById(projectId);
  const pageTitle = project?.name
    ? translate("web.runtime.page_title", { name: project?.name, section: t("common.cycles", { count: 2 }) })
    : undefined;
  const hasAdminLevelPermission = allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT);
  const hasFilters = calculateTotalFilters(currentProjectFilters ?? {}) !== 0;
  const hasSearch = searchQuery.trim() !== "";
  const filteredCycleIds = getFilteredCycleIdsForTab(cycleStore, projectId, tab);
  const totalCycles = Object.values(cycleMap).filter(
    (cycle) => cycle.project_id === projectId && !cycle.archived_at && isCycleInTab(cycle, tab)
  ).length;
  const showCycleCount = !loader && fetchedMap[projectId] && filteredCycleIds !== null;

  const handleRemoveFilter = (key: keyof TCycleFilters, value: string | null) => {
    let newValues = currentProjectFilters?.[key] ?? [];

    if (!value) newValues = [];
    else newValues = newValues.filter((val) => val !== value);

    updateFilters(projectId, { [key]: newValues });
  };

  // No access to cycle
  if (currentProjectDetails?.cycle_view === false)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <DetailedEmptyState
          title={t("disabled_project.empty_state.cycle.title")}
          description={t("disabled_project.empty_state.cycle.description")}
          assetPath={resolvedEmptyState}
          primaryButton={{
            text: t("disabled_project.empty_state.cycle.primary_button.text"),
            onClick: () => {
              router.push(`/${workspaceSlug}/settings/projects/${projectId}/features`);
            },
            disabled: !hasAdminLevelPermission,
          }}
        />
      </div>
    );

  if (loader) return <CycleModuleListLayoutLoader />;

  return (
    <>
      <PageHead title={pageTitle} />
      <div className="flex h-full min-h-0 w-full flex-col">
        <Header variant={EHeaderVariant.SECONDARY} setHeight={false} className="h-12 shrink-0">
          <Header.LeftItem className="h-full min-w-0 overflow-x-auto">
            <CycleTabNavigation workspaceSlug={workspaceSlug} projectId={projectId} tab={tab} />
          </Header.LeftItem>
          <Header.RightItem className="items-center">
            <CyclesViewHeader projectId={projectId} />
          </Header.RightItem>
        </Header>
        {(hasFilters || hasSearch) && (
          <Header variant={EHeaderVariant.TERNARY}>
            <Header.LeftItem>
              {hasFilters && (
                <CycleAppliedFiltersList
                  appliedFilters={currentProjectFilters ?? {}}
                  handleClearAllFilters={() => clearAllFilters(projectId)}
                  handleRemoveFilter={handleRemoveFilter}
                  alwaysAllowEditing
                />
              )}
            </Header.LeftItem>
            {showCycleCount && (
              <Header.RightItem>
                <Tooltip
                  label={t("web.runtime.matching_cycles", { matched: filteredCycleIds.length, total: totalCycles })}
                  layout="stacked"
                >
                  <Badge size="sm" variant="neutral" label={`${filteredCycleIds.length}/${totalCycles}`} />
                </Tooltip>
              </Header.RightItem>
            )}
          </Header>
        )}
        <div className="flex min-h-0 flex-1 flex-col">
          <CyclesView workspaceSlug={workspaceSlug} projectId={projectId} tab={tab} />
        </div>
      </div>
    </>
  );
}

export default observer(ProjectCyclesPage);
