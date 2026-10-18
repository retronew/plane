/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams, useRouter } from "next/navigation";
import scrollIntoView from "smooth-scroll-into-view-if-needed";
import { ChevronRightOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
// plane imports
import { useTranslation } from "@plane/i18n";
import { ProjectLogo } from "@plane/blocks/emoji-icon-picker";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { ControlLink } from "@plane/blocks/layout";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import { SortableItem } from "@plane/blocks/sortable";
import { cn } from "@plane/utils";
// components
import { DEFAULT_TAB_KEY, getTabUrl } from "@/components/navigation/tab-navigation-utils";
import { useTabPreferences } from "@/components/navigation/use-tab-preferences";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useProjectNavigationPreferences } from "@/hooks/use-navigation-preferences";
// local imports
import { SIDEBAR_ROW_CLASS_NAME, SIDEBAR_ROW_LINK_CLASS_NAME } from "@/components/sidebar/sidebar-navigation";
import { ProjectNavigation } from "./project-navigation";
import { SidebarProjectQuickActions } from "./project-quick-actions";
import { useNavigationItems } from "@/components/navigation/use-navigation-items";

type Props = {
  projectId: string;
  handleCopyText: () => void;
  index: number;
  group: string;
  disabled?: boolean;
  renderInExtendedSidebar?: boolean;
};

export const SidebarProjectsListItem = observer(function SidebarProjectsListItem(props: Props) {
  const { projectId, handleCopyText, index, group, disabled } = props;
  // store hooks
  const { t } = useTranslation();
  const { getPartialProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  const { getIsProjectListOpen, toggleProjectListOpen } = useCommandPalette();
  const { preferences: projectPreferences } = useProjectNavigationPreferences();
  const { isExtendedProjectSidebarOpened, toggleExtendedProjectSidebar, toggleAnySidebarDropdown } = useAppTheme();

  // states
  const [isMenuActive, setIsMenuActive] = useState(false);
  const isProjectListOpen = getIsProjectListOpen(projectId);
  const projectRef = useRef<HTMLDivElement | null>(null);
  // router
  const { workspaceSlug, projectId: URLProjectId } = useParams();
  const router = useRouter();
  // derived values
  const project = getPartialProjectById(projectId);

  // Get available navigation items for this project
  const navigationItems = useNavigationItems({
    workspaceSlug: workspaceSlug.toString(),
    projectId,
    project,
    allowPermissions,
  });
  const availableTabKeys = navigationItems.map((item) => item.key);

  // Get preferences from hook
  const { tabPreferences } = useTabPreferences(workspaceSlug.toString(), projectId);
  const defaultTabKey = tabPreferences.defaultTab;
  // Validate that the default tab is available
  const validatedDefaultTabKey = availableTabKeys.includes(defaultTabKey) ? defaultTabKey : DEFAULT_TAB_KEY;
  const defaultTabUrl = project ? getTabUrl(workspaceSlug.toString(), project.id, validatedDefaultTabKey) : "";

  // toggle project list open
  const setIsProjectListOpen = useCallback(
    (value: boolean) => toggleProjectListOpen(projectId, value),
    [projectId, toggleProjectListOpen]
  );
  useEffect(() => {
    if (isMenuActive) toggleAnySidebarDropdown(true);
    else toggleAnySidebarDropdown(false);
  }, [isMenuActive, toggleAnySidebarDropdown]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (URLProjectId === project?.id) {
      setIsProjectListOpen(true);
      // Scroll to active project
      if (projectRef.current) {
        timeoutId = setTimeout(() => {
          if (projectRef.current) {
            scrollIntoView(projectRef.current, {
              behavior: "smooth",
              block: "center",
              scrollMode: "if-needed",
            });
          }
        }, 200);
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [URLProjectId, project?.id, setIsProjectListOpen]);

  if (!project) return null;

  const isAccordionMode = projectPreferences.navigationMode === "ACCORDION";

  const handleItemClick = () => {
    if (projectPreferences.navigationMode === "ACCORDION") {
      setIsProjectListOpen(!isProjectListOpen);
    } else {
      router.push(defaultTabUrl);
    }
    // close the extended sidebar if it is open
    if (isExtendedProjectSidebarOpened && !isAccordionMode) {
      toggleExtendedProjectSidebar(false);
    }
  };

  const shouldHighlightProject = URLProjectId === project?.id && projectPreferences.navigationMode !== "ACCORDION";

  const primaryActionClassName = cn(
    SIDEBAR_ROW_LINK_CLASS_NAME,
    "absolute inset-0 px-2 text-left select-none",
    isAccordionMode
      ? "group-focus-within/project-item:pr-[60px] group-hover/project-item:pr-[60px]"
      : "group-focus-within/project-item:pr-9 group-hover/project-item:pr-9",
    isMenuActive && (isAccordionMode ? "pr-[60px]" : "pr-9")
  );

  return (
    <SortableItem
      id={projectId}
      index={index}
      group={group}
      disabled={disabled || project.sort_order === null}
      activation="row"
    >
      {({ handleRef }) => (
        <div ref={projectRef}>
          <div
            ref={handleRef}
            tabIndex={disabled || project.sort_order === null ? undefined : 0}
            aria-label={`${project.name}: ${t("drag_to_rearrange")}`}
            className={cn(SIDEBAR_ROW_CLASS_NAME, "group/project-item relative text-primary", {
              "bg-layer-transparent-selected hover:bg-layer-transparent-selected active:bg-layer-transparent-selected":
                shouldHighlightProject,
              "bg-layer-transparent-hover": isMenuActive && !shouldHighlightProject,
            })}
            id={project.id}
          >
            <>
              {isAccordionMode ? (
                <button
                  type="button"
                  onClick={handleItemClick}
                  className={primaryActionClassName}
                  aria-expanded={isProjectListOpen}
                  aria-label={
                    isProjectListOpen
                      ? t("aria_labels.projects_sidebar.close_project_menu")
                      : t("aria_labels.projects_sidebar.open_project_menu")
                  }
                >
                  <div className="grid size-4 flex-shrink-0 place-items-center">
                    <ProjectLogo logo={project.logo_props} size={16} />
                  </div>
                  <p
                    className={cn(
                      "truncate text-body-sm-medium",
                      shouldHighlightProject ? "text-primary" : "text-secondary"
                    )}
                  >
                    {project.name}
                  </p>
                </button>
              ) : (
                <ControlLink href={defaultTabUrl} className={primaryActionClassName} onClick={handleItemClick}>
                  <div className="grid size-4 flex-shrink-0 place-items-center">
                    <ProjectLogo logo={project.logo_props} size={16} />
                  </div>
                  <p
                    className={cn(
                      "truncate text-body-sm-medium",
                      shouldHighlightProject ? "text-primary" : "text-secondary"
                    )}
                  >
                    {project.name}
                  </p>
                </ControlLink>
              )}
              <div data-sortable-no-drag className="pointer-events-none relative ml-auto flex items-center gap-1">
                <div
                  className={cn(
                    "pointer-events-none flex shrink-0 items-center opacity-0 group-focus-within/project-item:pointer-events-auto group-focus-within/project-item:opacity-100 group-hover/project-item:pointer-events-auto group-hover/project-item:opacity-100",
                    {
                      "pointer-events-auto opacity-100": isMenuActive,
                    }
                  )}
                >
                  <Menu
                    onOpenChange={(open) => {
                      if (open) setIsMenuActive(true);
                    }}
                    onOpenChangeComplete={(open) => {
                      if (!open) setIsMenuActive(false);
                    }}
                  >
                    <MenuTrigger
                      render={
                        <IconButton
                          variant="ghost"
                          size="xs"
                          icon={<Icon icon={MoreHorizontalOutline} />}
                          aria-label={t("aria_labels.projects_sidebar.toggle_quick_actions_menu")}
                          // Render template only; IconButton carries the aria-label above.
                          // oxlint-disable-next-line jsx-a11y/control-has-associated-label
                          render={<button type="button" className="text-placeholder" />}
                        />
                      }
                    />
                    <SidebarProjectQuickActions
                      workspaceSlug={workspaceSlug.toString()}
                      project={project}
                      onCopyLink={handleCopyText}
                    />
                  </Menu>
                </div>
                {isAccordionMode && (
                  <span
                    className={cn(
                      "pointer-events-auto hidden text-placeholder group-focus-within/project-item:inline-flex group-hover/project-item:inline-flex",
                      {
                        "inline-flex": isMenuActive,
                      }
                    )}
                  >
                    <IconButton
                      variant="ghost"
                      size="xs"
                      icon={
                        <ChevronRightOutline
                          className={cn("size-3.5 transition-transform", {
                            "rotate-90": isProjectListOpen,
                          })}
                        />
                      }
                      onClick={() => setIsProjectListOpen(!isProjectListOpen)}
                      aria-expanded={isProjectListOpen}
                      aria-label={t(
                        isProjectListOpen
                          ? "aria_labels.projects_sidebar.close_project_menu"
                          : "aria_labels.projects_sidebar.open_project_menu"
                      )}
                    />
                  </span>
                )}
              </div>
            </>
          </div>
          {isAccordionMode && isProjectListOpen && (
            <div className="relative mt-1 mb-1.5 flex flex-col gap-0.5 pl-6">
              <div className="absolute top-0 bottom-1 left-[15px] w-[1px] bg-layer-3" />
              <ProjectNavigation workspaceSlug={workspaceSlug.toString()} projectId={projectId.toString()} />
            </div>
          )}
        </div>
      )}
    </SortableItem>
  );
});
