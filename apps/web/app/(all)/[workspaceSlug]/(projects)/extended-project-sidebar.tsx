/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { AddOutline, SearchOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Icon } from "@makeplane/propel/components/icon";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { copyUrlToClipboard } from "@plane/utils";
// components
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { SidebarProjectsListItem } from "@/components/workspace/sidebar/projects-list-item";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { SortableProvider } from "@plane/blocks/sortable";
import { useSidebarProjectSorting } from "@/components/workspace/sidebar/use-sidebar-project-sorting";
import { ExtendedSidebarWrapper } from "./extended-sidebar-wrapper";

export const ExtendedProjectSidebar = observer(function ExtendedProjectSidebar() {
  // refs
  const extendedProjectSidebarRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  // states
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  // routers
  const { workspaceSlug } = useParams();
  // store hooks
  const { t } = useTranslation();
  const { isExtendedProjectSidebarOpened, toggleExtendedProjectSidebar } = useAppTheme();
  const { getPartialProjectById, joinedProjectIds: joinedProjects } = useProject();
  const { allowPermissions } = useUserPermissions();

  // filter projects based on search query
  const filteredProjects = joinedProjects.filter((projectId) => {
    const project = getPartialProjectById(projectId);
    if (!project) return false;
    return project.name.toLowerCase().includes(searchQuery.toLowerCase()) || project.identifier.includes(searchQuery);
  });

  const sorting = useSidebarProjectSorting(workspaceSlug?.toString() ?? "", filteredProjects, "extended");

  // auth
  const isAuthorizedUser = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  const handleClose = useCallback(() => toggleExtendedProjectSidebar(false), [toggleExtendedProjectSidebar]);

  const handleCopyText = (projectId: string) => {
    copyUrlToClipboard(`${workspaceSlug}/projects/${projectId}/issues`).then(() => {
      setToast({
        type: "success",
        title: t("link_copied"),
        message: t("project_link_copied_to_clipboard"),
      });
      return undefined;
    });
  };
  return (
    <>
      {workspaceSlug && (
        <CreateProjectModal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          setToFavorite={false}
          workspaceSlug={workspaceSlug.toString()}
        />
      )}
      <ExtendedSidebarWrapper
        isExtendedSidebarOpened={!!isExtendedProjectSidebarOpened}
        extendedSidebarRef={extendedProjectSidebarRef}
        handleClose={handleClose}
        excludedElementId="extended-project-sidebar-toggle"
        className="px-0"
      >
        <div className="sticky top-4 flex w-full flex-col gap-1 px-4">
          <div className="flex items-center justify-between">
            <span className="py-1.5 text-13 font-semibold text-tertiary">{t("web.projects")}</span>
            {isAuthorizedUser && (
              <Tooltip label={t("create_project")}>
                <button
                  type="button"
                  aria-label={t("create_project")}
                  className="flex-shrink-0 rounded-sm p-0.5 text-tertiary transition-colors hover:bg-layer-1 hover:text-secondary"
                  onClick={() => {
                    setIsProjectModalOpen(true);
                  }}
                >
                  <AddOutline className="size-3" />
                </button>
              </Tooltip>
            )}
          </div>
          <div className="w-full">
            <InputGroup size="lg">
              <Icon icon={SearchOutline} tint="placeholder" />
              <Input
                size="lg"
                type="text"
                placeholder={t("search")}
                value={searchQuery}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus on open
                autoFocus
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
          </div>
        </div>
        {filteredProjects.length === 0 ? (
          <div className="mt-4 flex flex-col items-center p-10">
            <EmptyStateCompact
              title={t("common_empty_state.search.title")}
              description={t("common_empty_state.search.description")}
              assetKey="search"
              assetClassName="size-20"
              align="center"
            />
          </div>
        ) : (
          <div className="vertical-scrollbar mt-4 scrollbar-sm flex flex-grow flex-col gap-px overflow-x-hidden overflow-y-auto pr-2 pl-3">
            <SortableProvider onSortEnd={sorting.onSortEnd} disabled={sorting.isSaving}>
              {filteredProjects.map((projectId, index) => (
                <SidebarProjectsListItem
                  key={projectId}
                  projectId={projectId}
                  handleCopyText={() => handleCopyText(projectId)}
                  index={index}
                  group={sorting.group}
                  disabled={sorting.isSaving}
                />
              ))}
            </SortableProvider>
          </div>
        )}
      </ExtendedSidebarWrapper>
    </>
  );
});
