/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense, useCallback } from "react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import { LayoutTransition } from "@/components/common/layout-transition";
import { IssueLayoutLoader } from "@/components/issues/issue-layouts/issue-layout-HOC";
import { AllIssueQuickActions } from "@/components/issues/issue-layouts/quick-action-dropdowns";
import { EIssueLayoutTypes } from "@plane/types";
import { WorkspaceSpreadsheetRoot } from "@/components/issues/issue-layouts/spreadsheet/roots/workspace-root";

export type TWorkspaceLayoutProps = {
  activeLayout: EIssueLayoutTypes | undefined;
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

const ListLayout = lazy(() =>
  import("@/components/issues/issue-layouts/list/base-list-root").then((m) => ({ default: m.BaseListRoot }))
);
const KanbanLayout = lazy(() =>
  import("@/components/issues/issue-layouts/kanban/base-kanban-root").then((m) => ({ default: m.BaseKanBanRoot }))
);
const CalendarLayout = lazy(() =>
  import("@/components/issues/issue-layouts/calendar/base-calendar-root").then((m) => ({ default: m.BaseCalendarRoot }))
);
const GanttLayout = lazy(() =>
  import("@/components/issues/issue-layouts/gantt/base-gantt-root").then((m) => ({ default: m.BaseGanttRoot }))
);

export function WorkspaceActiveLayout(props: TWorkspaceLayoutProps) {
  const {
    activeLayout = EIssueLayoutTypes.SPREADSHEET,
    workspaceSlug,
    globalViewId,
    globalViewsLoading,
    issuesLoading,
    isLoading,
    onLayoutCommit,
  } = props;
  const { allowPermissions } = useUserPermissions();
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
  if (globalViewsLoading || issuesLoading || isLoading) return <IssueLayoutLoader layout={activeLayout} />;
  const sharedProps = { QuickActions: AllIssueQuickActions, canEditPropertiesBasedOnProject, viewId: globalViewId };
  return (
    <LayoutTransition layout={activeLayout} waitForReady onLayoutCommit={onLayoutCommit}>
      {(layout) => (
        <Suspense fallback={<IssueLayoutLoader layout={layout} />}>
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
