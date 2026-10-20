/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Tab, Tabs, TabsList, TabsPanel } from "@makeplane/propel/components/tabs";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { ActivityOutline, AlertCircleOutline, UpdatesOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { ProjectOverviewProperties } from "./properties";
import { ProjectOverviewUpdates } from "./updates";
import { ProjectOverviewActivity } from "./activity";

export function ProjectOverviewSidebar(props: { project: IProject; workspaceSlug: string; disabled: boolean }) {
  const { t } = useTranslation();
  return (
    <aside
      id="project-overview-sidebar"
      aria-label={t("common.properties")}
      className="w-full shrink-0 border-t border-subtle bg-surface-1 p-6 lg:h-full lg:w-96 lg:overflow-y-auto lg:border-t-0 lg:border-l"
    >
      <Tabs variant="contained" stretch="full" defaultValue="properties">
        <TabsList>
          <Tooltip label={t("common.properties")}>
            <Tab
              value="properties"
              label=""
              aria-label={t("common.properties")}
              icon={<AlertCircleOutline className="size-4" />}
            />
          </Tooltip>
          <Tooltip label={t("web.project_overview.updates")}>
            <Tab
              value="updates"
              label=""
              aria-label={t("web.project_overview.updates")}
              icon={<UpdatesOutline className="size-4" />}
            />
          </Tooltip>
          <Tooltip label={t("activity")}>
            <Tab value="activity" label="" aria-label={t("activity")} icon={<ActivityOutline className="size-4" />} />
          </Tooltip>
        </TabsList>
        <TabsPanel value="properties">
          <div className="pt-4">
            <ProjectOverviewProperties {...props} />
          </div>
        </TabsPanel>
        <TabsPanel value="updates" keepMounted>
          <div className="pt-4">
            <ProjectOverviewUpdates project={props.project} workspaceSlug={props.workspaceSlug} />
          </div>
        </TabsPanel>
        <TabsPanel value="activity">
          <div className="pt-4">
            <ProjectOverviewActivity workspaceSlug={props.workspaceSlug} projectId={props.project.id} />
          </div>
        </TabsPanel>
      </Tabs>
    </aside>
  );
}
