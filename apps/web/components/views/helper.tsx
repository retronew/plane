/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense, useCallback, useEffect } from "react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import { LayoutTransition } from "@/components/common/layout-transition";
import { IssueLayoutLoader } from "@/components/issues/issue-layouts/issue-layout-HOC";
import { AllIssueQuickActions } from "@/components/issues/issue-layouts/quick-action-dropdowns";
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
import { WorkspaceSpreadsheetRoot } from "@/components/issues/issue-layouts/spreadsheet/roots/workspace-root";

export type TWorkspaceLayoutProps = {
  activeLayout: EIssueLayoutTypes | undefined;
  displayFilters?: IIssueDisplayFilterOptions;
  displayProperties?: IIssueDisplayProperties;
  onLayoutCommit?: (layout: EIssueLayoutTypes) => void;
  isDefaultView: boolean;
  isLoading?: boolean;
  toggleLoading: (value: boolean) => void;
  workspaceSlug: string;
  globalViewId: string;
  routeFilters: {
    [key: string]: string;
  };
  fetchNextPages: () => void;
  globalViewsLoading: boolean;
  issuesLoading: boolean;
};

const loadListLayout = () =>
  import("@/components/issues/issue-layouts/list/base-list-root").then((m) => ({ default: m.BaseListRoot }));
const loadKanbanLayout = () =>
  import("@/components/issues/issue-layouts/kanban/base-kanban-root").then((m) => ({ default: m.BaseKanBanRoot }));
const loadCalendarLayout = () =>
  import("@/components/issues/issue-layouts/calendar/base-calendar-root").then((m) => ({
    default: m.BaseCalendarRoot,
  }));
const loadGanttLayout = () =>
  import("@/components/issues/issue-layouts/gantt/base-gantt-root").then((m) => ({ default: m.BaseGanttRoot }));

const ListLayout = lazy(loadListLayout);
const KanbanLayout = lazy(loadKanbanLayout);
const CalendarLayout = lazy(loadCalendarLayout);
const GanttLayout = lazy(loadGanttLayout);

let hasPreloadedWorkspaceLayouts = false;

export function WorkspaceActiveLayout(props: TWorkspaceLayoutProps) {
  const {
    activeLayout = EIssueLayoutTypes.SPREADSHEET,
    displayFilters,
    displayProperties,
    isDefaultView,
    workspaceSlug,
    globalViewId,
    globalViewsLoading,
    issuesLoading,
    isLoading,
    onLayoutCommit,
  } = props;
  const { allowPermissions } = useUserPermissions();

  // Warm the sibling layout chunks in idle time so mode switching doesn't stall on dynamic imports.
  useEffect(() => {
    if (hasPreloadedWorkspaceLayouts || typeof window === "undefined") return;
    const warm = () => {
      hasPreloadedWorkspaceLayouts = true;
      void loadListLayout();
      void loadKanbanLayout();
      void loadCalendarLayout();
      void loadGanttLayout();
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, 800);
    return () => window.clearTimeout(timer);
  }, []);

  const canEditPropertiesBasedOnProject = useCallback(
    (projectId: string) =>
      allowPermissions(
        [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
        EUserPermissionsLevel.PROJECT,
        workspaceSlug,
        projectId
      ),
    [allowPermissions, workspaceSlug]
  );

  const propertyCount = displayProperties
    ? Object.entries(displayProperties).filter(([key, enabled]) => key !== "key" && enabled).length
    : undefined;
  const loaderProps = {
    grouped: displayFilters?.group_by != null,
    displayProperties,
    propertyCount,
    showWeekends: displayFilters?.calendar?.show_weekends,
    calendarLayout: displayFilters?.calendar?.layout,
  };

  if ((!isDefaultView && globalViewsLoading) || issuesLoading || isLoading)
    return <IssueLayoutLoader layout={activeLayout} {...loaderProps} />;
  const sharedProps = { QuickActions: AllIssueQuickActions, canEditPropertiesBasedOnProject, viewId: globalViewId };
  return (
    <LayoutTransition layout={activeLayout} waitForReady animateInitial={false} onLayoutCommit={onLayoutCommit}>
      {(layout) => (
        <Suspense fallback={<IssueLayoutLoader layout={layout} {...loaderProps} />}>
          {layout === EIssueLayoutTypes.LIST ? (
            <ListLayout {...sharedProps} />
          ) : layout === EIssueLayoutTypes.KANBAN ? (
            <KanbanLayout {...sharedProps} />
          ) : layout === EIssueLayoutTypes.CALENDAR ? (
            <CalendarLayout {...sharedProps} />
          ) : layout === EIssueLayoutTypes.GANTT ? (
            <GanttLayout viewId={globalViewId} canEditPropertiesBasedOnProject={canEditPropertiesBasedOnProject} />
          ) : (
            <WorkspaceSpreadsheetRoot {...props} />
          )}
        </Suspense>
      )}
    </LayoutTransition>
  );
}

export type TLayoutSelectionProps = {
  onChange: (layout: EIssueLayoutTypes) => void;
  selectedLayout: EIssueLayoutTypes;
  workspaceSlug: string;
};
