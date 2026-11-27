/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { lazy, Suspense } from "react";
// plane imports
import { EUserPermissionsLevel, EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { ContentWrapper } from "@plane/blocks/layout";
// components
import { calculateTotalFilters } from "@plane/utils";
import { ProjectsLoader } from "@/components/ui/loader/projects-loader";
import { LayoutTransitionContent } from "@/components/common/layout-transition";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useProjectFilter } from "@/hooks/store/use-project-filter";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { ProjectCard } from "./card";
import { ProjectLayoutTransition } from "./layout-transition";
import type { IProject, TProjectDisplayFilters, TProjectFilters } from "@plane/types";
const ProjectLayouts = lazy(() => import("./layouts").then((module) => ({ default: module.ProjectLayouts })));

type TProjectCardListProps = {
  totalProjectIds?: string[];
  filteredProjectIds?: string[];
};

const isArchivedProjectsEmptyState = (
  displayFilters: TProjectDisplayFilters | undefined,
  filters: TProjectFilters | undefined
) => !!displayFilters?.archived_projects && calculateTotalFilters(filters ?? {}) === 0;

const getProjectLayout = (displayFilters: TProjectDisplayFilters | undefined) => displayFilters?.layout ?? "gallery";

const getSearchEmptyStateContent = (isArchivedProjectsView: boolean) =>
  isArchivedProjectsView
    ? ({
        title: "workspace_empty_state.projects_archived.title",
        description: "workspace_empty_state.projects_archived.description",
        assetKey: "archived-work-item",
      } as const)
    : ({
        title: "common_empty_state.search.title",
        description: "common_empty_state.search.description",
        assetKey: "search",
      } as const);

function ProjectCardListEmptyState({ canPerformEmptyStateActions }: { canPerformEmptyStateActions: boolean }) {
  const { t } = useTranslation();
  const { toggleCreateProjectModal } = useCommandPalette();

  return (
    <EmptyStateDetailed
      title={t("workspace_projects.empty_state.general.title")}
      description={t("workspace_projects.empty_state.general.description")}
      assetKey="project"
      assetClassName="size-40"
      actions={[
        {
          label: t("workspace_projects.empty_state.general.primary_button.text"),
          onClick: () => {
            toggleCreateProjectModal(true);
          },
          disabled: !canPerformEmptyStateActions,
          variant: "primary",
        },
      ]}
    />
  );
}

function ProjectCardListSearchEmptyState({ isArchivedProjectsView }: { isArchivedProjectsView: boolean }) {
  const { t } = useTranslation();
  const content = getSearchEmptyStateContent(isArchivedProjectsView);

  return (
    <EmptyStateDetailed
      title={t(content.title)}
      description={t(content.description)}
      assetKey={content.assetKey}
      assetClassName="size-40"
    />
  );
}

export const ProjectCardList = observer(function ProjectCardList(props: TProjectCardListProps) {
  const { totalProjectIds: totalProjectIdsProps, filteredProjectIds: filteredProjectIdsProps } = props;
  // store hooks
  const {
    loader,
    fetchStatus,
    workspaceProjectIds: storeWorkspaceProjectIds,
    filteredProjectIds: storeFilteredProjectIds,
    getProjectById,
  } = useProject();
  const { currentWorkspaceDisplayFilters, currentWorkspaceFilters } = useProjectFilter();
  const { allowPermissions } = useUserPermissions();

  // derived values
  const workspaceProjectIds = totalProjectIdsProps ?? storeWorkspaceProjectIds;
  const filteredProjectIds = filteredProjectIdsProps ?? storeFilteredProjectIds;
  const isArchivedProjectsView = isArchivedProjectsEmptyState(currentWorkspaceDisplayFilters, currentWorkspaceFilters);

  // permissions
  const canPerformEmptyStateActions = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  const hasRenderableProjects =
    Boolean(filteredProjectIds && workspaceProjectIds) &&
    (fetchStatus === "complete" || (fetchStatus === "partial" && (workspaceProjectIds?.length ?? 0) > 0));

  if (!hasRenderableProjects || (loader === "init-loader" && (workspaceProjectIds?.length ?? 0) === 0))
    return <ProjectsLoader layout={getProjectLayout(currentWorkspaceDisplayFilters)} />;

  if (workspaceProjectIds!.length === 0 && !currentWorkspaceDisplayFilters?.archived_projects)
    return <ProjectCardListEmptyState canPerformEmptyStateActions={canPerformEmptyStateActions} />;

  if (filteredProjectIds!.length === 0)
    return <ProjectCardListSearchEmptyState isArchivedProjectsView={isArchivedProjectsView} />;

  const projects = filteredProjectIds!
    .map((id) => getProjectById(id))
    .filter((project): project is IProject => !!project);

  return (
    <ProjectLayoutTransition
      layout={getProjectLayout(currentWorkspaceDisplayFilters)}
      waitForReady
      animateInitial={false}
    >
      {(layout) =>
        layout === "gallery" ? (
          <LayoutTransitionContent>
            <ContentWrapper className="p-4!">
              <div
                data-project-layout="gallery"
                className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              >
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </ContentWrapper>
          </LayoutTransitionContent>
        ) : (
          <Suspense fallback={<ProjectsLoader layout={layout} />}>
            <LayoutTransitionContent>
              <ContentWrapper className={["list", "board", "timeline"].includes(layout) ? "p-0!" : "p-4!"}>
                <ProjectLayouts key={layout} layout={layout} projects={projects} />
              </ContentWrapper>
            </LayoutTransitionContent>
          </Suspense>
        )
      }
    </ProjectLayoutTransition>
  );
});
