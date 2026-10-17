/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext } from "react";
import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { PageHead } from "@/components/core/page-title";
import { ProjectOverviewContent } from "@/components/project/overview/content";
import { ProjectOverviewContext } from "@/components/project/overview/context";
import { ProjectOverviewSidebar } from "@/components/project/overview/sidebar";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import type { Route } from "./+types/page";

function ProjectOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { getProjectById, loader } = useProject();
  const { allowPermissions } = useUserPermissions();
  const sidebarOpen = useContext(ProjectOverviewContext);
  const { t } = useTranslation();
  const project = getProjectById(projectId);
  const pageTitle = project
    ? t("web.runtime.page_title", { name: project.name, section: t("common.overview") })
    : t("common.overview");

  if (!project) {
    return (
      <>
        <PageHead title={pageTitle} />
        {loader === "init-loader" ? (
          <output aria-label={t("loading")} className="grid h-full w-full place-items-center">
            <LogoSpinner />
          </output>
        ) : (
          <div className="grid h-full w-full place-items-center">
            <EmptyStateDetailed
              title={t("project_empty_state.invalid_project.title")}
              description={t("project_empty_state.invalid_project.description")}
              assetKey="project"
              assetClassName="size-40"
            />
          </div>
        )}
      </>
    );
  }

  const canEdit =
    !project.archived_at &&
    (project.member_role === EUserPermissions.ADMIN ||
      allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug));
  return (
    <>
      <PageHead title={pageTitle} />
      <div className="flex min-h-full w-full flex-col bg-surface-1 lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
        <ProjectOverviewContent
          key={`content-${projectId}`}
          project={project}
          workspaceSlug={workspaceSlug}
          disabled={!canEdit}
        />
        {sidebarOpen && (
          <ProjectOverviewSidebar
            key={`sidebar-${projectId}`}
            project={project}
            workspaceSlug={workspaceSlug}
            disabled={!canEdit}
          />
        )}
      </div>
    </>
  );
}

export default observer(ProjectOverviewPage);
