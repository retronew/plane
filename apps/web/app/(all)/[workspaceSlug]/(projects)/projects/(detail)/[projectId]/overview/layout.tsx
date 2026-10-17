/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Outlet } from "react-router";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectOverviewContext } from "@/components/project/overview/context";
import { ProjectOverviewHeader } from "./header";

export default function ProjectOverviewLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <ProjectOverviewContext.Provider value={sidebarOpen}>
      <AppHeader
        header={
          <ProjectOverviewHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        }
      />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </ProjectOverviewContext.Provider>
  );
}
