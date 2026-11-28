/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import { Outlet } from "react-router";
// plane imports
import { Header, Row } from "@plane/blocks/layout";
import { cn } from "@plane/utils";
// components
import { ProjectOverviewSkeleton } from "@/components/common/loaders/project-overview-skeleton";
import { TabNavigationRoot } from "@/components/navigation/tab-navigation-root";
import { PageContentLoader } from "@/components/pages/loaders/page-content-loader";
import { PageLoader } from "@/components/pages/loaders/page-loader";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { CycleModuleBoardLayoutLoader } from "@/components/ui/loader/cycle-module-board-loader";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
import { ListLayoutLoader } from "@/components/ui/loader/layouts/list-layout-loader";
import { InboxLayoutLoader } from "@/components/ui/loader/layouts/project-inbox/inbox-layout-loader";
import { ViewListLoader } from "@/components/ui/loader/view-list-loader";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useProjectNavigationPreferences } from "@/hooks/use-navigation-preferences";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
// local imports
import type { Route } from "./+types/layout";

function getProjectRouteLoadingFallback(pathname: string) {
  if (/\/overview\/?$/.test(pathname)) return <ProjectOverviewSkeleton />;
  if (/\/cycles\/?$/.test(pathname)) return <CycleModuleListLayoutLoader />;
  if (/\/modules\/?$/.test(pathname)) return <CycleModuleBoardLayoutLoader />;
  if (/\/views\/?$/.test(pathname)) return <ViewListLoader />;
  if (/\/pages\/[^/]+\/?$/.test(pathname)) return <PageContentLoader showToolbar />;
  if (/\/pages\/?$/.test(pathname)) return <PageLoader />;
  if (/\/intake\/?$/.test(pathname)) return <InboxLayoutLoader />;
  return <ListLayoutLoader />;
}

function ProjectLayout({ params }: Route.ComponentProps) {
  // router
  const { workspaceSlug, projectId } = params;
  const pathname = usePathname();
  // store hooks
  const { sidebarCollapsed } = useAppTheme();
  // preferences
  const { preferences: projectPreferences } = useProjectNavigationPreferences();

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
        loadingFallback={getProjectRouteLoadingFallback(pathname)}
      >
        <Outlet />
      </ProjectAuthWrapper>
    </>
  );
}

export default observer(ProjectLayout);
