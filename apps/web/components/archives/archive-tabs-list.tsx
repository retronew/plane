/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams, useLocation } from "react-router";
import { TabsList } from "@makeplane/propel/components/tabs";
import { AnimatedUnderlineTabs } from "@/components/navigation/animated-underline-tabs";
import { UnderlineTabLink } from "@/components/navigation/underline-tab-link";
// types
import type { IProject } from "@plane/types";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { translate } from "@plane/i18n";

const ARCHIVES_TAB_LIST: {
  key: string;
  label: string;
  shouldRender: (projectDetails: IProject) => boolean;
}[] = [
  {
    key: "issues",
    get label() {
      return translate("web.work_items_af8f");
    },
    shouldRender: () => true,
  },
  {
    key: "cycles",
    get label() {
      return translate("web.cycles");
    },
    shouldRender: (projectDetails) => projectDetails.cycle_view,
  },
  {
    key: "modules",
    get label() {
      return translate("web.title_modules");
    },
    shouldRender: (projectDetails) => projectDetails.module_view,
  },
];

export const ArchiveTabsList = observer(function ArchiveTabsList() {
  // router
  const { workspaceSlug, projectId } = useParams();
  const { pathname } = useLocation();
  // store hooks
  const { getProjectById } = useProject();

  // derived values
  if (!projectId) return null;
  const projectDetails = getProjectById(projectId?.toString());
  if (!projectDetails) return null;

  const basePath = `/${workspaceSlug}/projects/${projectId}/archives`;
  const visibleTabs = ARCHIVES_TAB_LIST.filter((tab) => tab.shouldRender(projectDetails));
  const activeTab =
    visibleTabs.find((tab) => pathname === `${basePath}/${tab.key}` || pathname.startsWith(`${basePath}/${tab.key}/`))
      ?.key ?? "issues";

  return (
    <div className="max-w-full min-w-0 pt-3">
      <AnimatedUnderlineTabs value={activeTab} motionKey={`${basePath}`}>
        <TabsList>
          {visibleTabs.map((tab) => (
            <UnderlineTabLink key={tab.key} value={tab.key} label={tab.label} to={`${basePath}/${tab.key}/`} />
          ))}
        </TabsList>
      </AnimatedUnderlineTabs>
    </div>
  );
});
