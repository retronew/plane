/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams, usePathname } from "next/navigation";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { AddOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Loader } from "@plane/blocks/skeleton";
import { copyUrlToClipboard, cn } from "@plane/utils";
// components
import { CreateProjectModal } from "@/components/project/create-project-modal";
import {
  SidebarNavItem,
  SIDEBAR_ROW_CLASS_NAME,
  SIDEBAR_ROW_LINK_CLASS_NAME,
} from "@/components/sidebar/sidebar-navigation";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useProjectNavigationPreferences } from "@/hooks/use-navigation-preferences";
// plane web imports
import { SortableProvider } from "@plane/blocks/sortable";
import { useSidebarProjectSorting } from "./use-sidebar-project-sorting";
// local imports
import { SidebarProjectsListItem } from "./projects-list-item";

export const SidebarProjectsList = observer(function SidebarProjectsList() {
  // states
  const [isAllProjectsListOpen, setIsAllProjectsListOpen] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false); // scroll animation state
  // refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  // store hooks
  const { t } = useTranslation();
  const { toggleCreateProjectModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();
  const { preferences: projectPreferences } = useProjectNavigationPreferences();
  const { isExtendedProjectSidebarOpened, toggleExtendedProjectSidebar } = useAppTheme();

  const { loader, joinedProjectIds: joinedProjects } = useProject();
  // router params
  const { workspaceSlug } = useParams();
  const pathname = usePathname();

  // auth
  const isAuthorizedUser = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  // Compute limited projects for main sidebar
  const displayedProjects = projectPreferences.showLimitedProjects
    ? joinedProjects.slice(0, projectPreferences.limitedProjectsCount)
    : joinedProjects;

  // Check if there are more projects to show
  const hasMoreProjects =
    projectPreferences.showLimitedProjects && joinedProjects.length > projectPreferences.limitedProjectsCount;

  const handleCopyText = async (projectId: string) => {
    await copyUrlToClipboard(`${workspaceSlug}/projects/${projectId}/issues`);
    setToast({
      type: "success",
      title: t("link_copied"),
      message: t("project_link_copied_to_clipboard"),
    });
  };

  const sorting = useSidebarProjectSorting(workspaceSlug?.toString() ?? "", displayedProjects, "main");

  /**
   * Implementing scroll animation styles based on the scroll length of the container
   */
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const scrollTop = containerRef.current.scrollTop;
        setIsScrolled(scrollTop > 0);
      }
    };
    const currentContainerRef = containerRef.current;
    if (currentContainerRef) {
      currentContainerRef.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (currentContainerRef) {
        currentContainerRef.removeEventListener("scroll", handleScroll);
      }
    };
  }, [containerRef]);

  const toggleListDisclosure = (isOpen: boolean) => {
    setIsAllProjectsListOpen(isOpen);
    localStorage.setItem("isAllProjectsListOpen", isOpen.toString());
  };
  useEffect(() => {
    if (pathname.includes("projects")) {
      setIsAllProjectsListOpen(true);
      localStorage.setItem("isAllProjectsListOpen", "true");
    }
  }, [pathname]);
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
      <div
        ref={containerRef}
        className={cn({
          "border-t border-strong": isScrolled,
        })}
      >
        <>
          <Collapsible
            placement="sidebar"
            // the group marker lives on the root: CollapsibleHeader takes no className
            render={<div className="group/projects-section" />}
            open={isAllProjectsListOpen}
            onOpenChange={toggleListDisclosure}
            trigger={<span className="text-13 font-semibold whitespace-nowrap text-placeholder">{t("projects")}</span>}
            trailing={
              isAuthorizedUser ? (
                <span className="hidden text-placeholder group-focus-within/projects-section:inline-flex group-hover/projects-section:inline-flex">
                  <Tooltip label={t("create_project")}>
                    <IconButton
                      variant="ghost"
                      size="xs"
                      icon={<Icon icon={AddOutline} />}
                      onClick={() => {
                        setIsProjectModalOpen(true);
                      }}
                      aria-label={t("aria_labels.projects_sidebar.create_new_project")}
                    />
                  </Tooltip>
                </span>
              ) : null
            }
          >
            <div className="flex flex-col gap-px">
              {loader === "init-loader" && (
                <Loader className="w-full space-y-1.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    // oxlint-disable-next-line react/no-array-index-key
                    <Loader.Item key={index} height="32px" />
                  ))}
                </Loader>
              )}
              <SortableProvider onSortEnd={sorting.onSortEnd} disabled={sorting.isSaving}>
                {displayedProjects.map((projectId, index) => (
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
              {hasMoreProjects && (
                <SidebarNavItem className="py-0">
                  <button
                    type="button"
                    onClick={() => toggleExtendedProjectSidebar()}
                    className={cn(SIDEBAR_ROW_LINK_CLASS_NAME, "text-tertiary")}
                    id="extended-project-sidebar-toggle"
                    aria-label={t(
                      isExtendedProjectSidebarOpened
                        ? "aria_labels.projects_sidebar.close_extended_sidebar"
                        : "aria_labels.projects_sidebar.open_extended_sidebar"
                    )}
                  >
                    <MoreHorizontalOutline className="size-4 flex-shrink-0" />
                    <span>{isExtendedProjectSidebarOpened ? t("web.hide") : t("web.more")}</span>
                  </button>
                </SidebarNavItem>
              )}
            </div>
          </Collapsible>
        </>

        {isAuthorizedUser && joinedProjects?.length === 0 && (
          <button
            type="button"
            className={cn(SIDEBAR_ROW_CLASS_NAME, "w-full text-secondary")}
            onClick={() => {
              toggleCreateProjectModal(true);
            }}
          >
            {t("add_project")}
          </button>
        )}
      </div>
    </>
  );
});
