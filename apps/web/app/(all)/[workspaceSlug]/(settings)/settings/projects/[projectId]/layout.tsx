/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { usePathname, useParams } from "next/navigation";
import { Outlet } from "react-router";
// components
import { getProjectActivePath } from "@/components/settings/helper";
import { SettingsMobileNav } from "@/components/settings/mobile/nav";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
// types
import type { Route } from "./+types/layout";
import { ProjectSettingsSidebarRoot } from "@/components/settings/project/sidebar";
import { SettingsDesktopSidebar, SettingsSidebarProvider } from "@/components/settings/sidebar/collapse";

function ProjectSettingsMobileSidebar() {
  const { projectId } = useParams();
  return <ProjectSettingsSidebarRoot projectId={projectId?.toString() ?? ""} />;
}

function ProjectDetailSettingsLayout({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  // router
  const pathname = usePathname();

  return (
    <SettingsSidebarProvider scope="project">
      <SettingsMobileNav
        hamburgerContent={ProjectSettingsMobileSidebar}
        activePath={getProjectActivePath(pathname) || ""}
      />
      <div className="inset-y-0 flex h-full w-full flex-row">
        <div className="relative flex size-full">
          <SettingsDesktopSidebar>
            <ProjectSettingsSidebarRoot projectId={projectId} />
          </SettingsDesktopSidebar>
          <ProjectAuthWrapper workspaceSlug={workspaceSlug} projectId={projectId}>
            <Outlet />
          </ProjectAuthWrapper>
        </div>
      </div>
    </SettingsSidebarProvider>
  );
}

export default observer(ProjectDetailSettingsLayout);
