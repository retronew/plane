/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import { Outlet } from "react-router";
// plane imports
import { preloadDetailedAsset } from "@plane/blocks/empty-state";
import { Header, Row } from "@plane/blocks/layout";
import { EIssueLayoutTypes } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { ProjectOverviewSkeleton } from "@/components/common/loaders/project-overview-skeleton";
import { IssueLayoutLoader } from "@/components/issues/issue-layouts/issue-layout-HOC";
import { TabNavigationRoot } from "@/components/navigation/tab-navigation-root";
import { PageContentLoader } from "@/components/pages/loaders/page-content-loader";
import { PageLoader } from "@/components/pages/loaders/page-loader";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { ActiveCyclesLoader } from "@/components/ui/loader/active-cycles-loader";
import { CycleModuleBoardLayoutLoader } from "@/components/ui/loader/cycle-module-board-loader";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
import { InboxLayoutLoader } from "@/components/ui/loader/layouts/project-inbox/inbox-layout-loader";
import { ViewListLoader } from "@/components/ui/loader/view-list-loader";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useModuleFilter } from "@/hooks/store/use-module-filter";
import { useProjectNavigationPreferences } from "@/hooks/use-navigation-preferences";
import { readCachedIssueLayout } from "@/lib/layout-cache";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
// local imports
import type { Route } from "./+types/layout";

function getProjectRouteLoadingFallback(
  pathname: string,
  workspaceSlug: string,
  projectId: string,
  moduleLayout?: string
) {
  if (/\/overview\/?$/.test(pathname)) return <ProjectOverviewSkeleton />;
  if (/\/cycles\/?$/.test(pathname)) return <ActiveCyclesLoader count={1} />;
  if (/\/modules\/?$/.test(pathname))
    return moduleLayout === "list" ? <CycleModuleListLayoutLoader /> : <CycleModuleBoardLayoutLoader />;
  if (/\/views\/?$/.test(pathname)) return <ViewListLoader />;
  const viewDetailMatch = pathname.match(/\/views\/([^/]+)\/?$/);
  if (viewDetailMatch?.[1]) {
    const layout = readCachedIssueLayout("project-view", workspaceSlug, viewDetailMatch[1]) ?? EIssueLayoutTypes.LIST;
    return <IssueLayoutLoader layout={layout} />;
  }
  if (/\/pages\/[^/]+\/?$/.test(pathname)) return <PageContentLoader showToolbar />;
  if (/\/pages\/?$/.test(pathname)) return <PageLoader />;
  if (/\/intake\/?$/.test(pathname)) return <InboxLayoutLoader />;
  const projectLayout = readCachedIssueLayout("project", workspaceSlug, projectId) ?? EIssueLayoutTypes.LIST;
  return <IssueLayoutLoader layout={projectLayout} />;
}

function ProjectLayout({ params }: Route.ComponentProps) {
  // router
  const { workspaceSlug, projectId } = params;
  const pathname = usePathname();
  // store hooks
  const { sidebarCollapsed } = useAppTheme();
  const { getDisplayFiltersByProjectId } = useModuleFilter();
  const moduleLayout = getDisplayFiltersByProjectId(projectId)?.layout;
  // preferences
  const { preferences: projectPreferences } = useProjectNavigationPreferences();

  // Warm the route's empty-state SVG while ProjectAuthWrapper loads so empty pages render in a single frame.
  useEffect(() => {
    if (/\/cycles\/?$/.test(pathname)) {
      preloadDetailedAsset("cycle");
      preloadDetailedAsset("archived-cycle");
    } else if (/\/modules\/?$/.test(pathname)) {
      preloadDetailedAsset("module");
    } else if (/\/views\/?$/.test(pathname)) {
      preloadDetailedAsset("view");
    } else if (/\/issues\/?$/.test(pathname)) {
      preloadDetailedAsset("work-item");
    } else if (/\/pages\/?$/.test(pathname)) {
      preloadDetailedAsset("page");
    } else if (/\/intake\/?$/.test(pathname)) {
      preloadDetailedAsset("intake");
    }
  }, [pathname]);

  return (
    <>
      {projectPreferences.navigationMode === "TABBED" && (
        <div className="z-20">
          <Row className="flex h-header w-full items-center gap-2 border-b border-subtle bg-surface-1">
            <div className="flex h-full w-full items-center gap-2 divide-x divide-subtle">
              <div className="flex size-full flex-1 items-center gap-2">
                {sidebarCollapsed && (
                  <div className="shrink-0">
                    <AppSidebarToggleButton />
                  </div>
                )}
                <Header className={cn("h-full", { "pl-1.5": !sidebarCollapsed })}>
                  <Header.LeftItem className="flex h-full max-w-full items-center gap-2">
                    <TabNavigationRoot workspaceSlug={workspaceSlug} projectId={projectId} />
                  </Header.LeftItem>
                </Header>
              </div>
            </div>
          </Row>
        </div>
      )}
      <ProjectAuthWrapper
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        loadingFallback={getProjectRouteLoadingFallback(pathname, workspaceSlug, projectId, moduleLayout)}
      >
        <Outlet />
      </ProjectAuthWrapper>
    </>
  );
}

export default observer(ProjectLayout);
