/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// components
import { Outlet } from "react-router";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { WorkspaceDraftViewProvider } from "@/components/issues/workspace-draft/draft-view-context";
// local imports
import { WorkspaceDraftHeader } from "./header";

export default function WorkspaceDraftLayout() {
  return (
    <WorkspaceDraftViewProvider>
      <AppHeader header={<WorkspaceDraftHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </WorkspaceDraftViewProvider>
  );
}
