import { ProjectStatusSelect } from "@/components/settings/workspace/configuration/project-status-select";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Menu, MenuTrigger, MenuItem } from "@makeplane/propel/components/menu";
import { MoreHorizontal } from "lucide-react";
import { ActionMenuContent } from "@plane/blocks/common";
import { SidebarProjectQuickActions } from "@/components/workspace/sidebar/project-quick-actions";
import { ProjectCardProperties } from "./card-properties";
import React, { useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DeleteOutline,
  LinkOutline,
  LockOutline,
  NewTabOutline,
  RestoreOutline,
  SettingsOutline,
  UserPlusOutline,
} from "@makeplane/propel/icons";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, IS_FAVORITE_MENU_OPEN } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { ProjectLogo, getIconBackgroundStyle } from "@plane/blocks/emoji-icon-picker";
import { setPromiseToast, setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IProject } from "@plane/types";
import type { TContextMenuItem } from "@plane/blocks/context-menu";
import { ContextMenu } from "@plane/blocks/context-menu";
import { FavoriteStar } from "@plane/blocks/common";
import { copyUrlToClipboard, cn } from "@plane/utils";
// components
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// local imports
import { CoverImage } from "@/components/common/cover-image";
import { DeleteProjectModal } from "./delete-project-modal";
import { JoinProjectModal } from "./join-project-modal";
import { ArchiveRestoreProjectModal } from "./archive-restore-modal";
import { translate } from "@plane/i18n";

type Props = {
  project: IProject;
  compact?: boolean;
  hideProperties?: boolean;
  className?: string;
  wrapProperties?: boolean;
};

export const ProjectCard = observer(function ProjectCard(props: Props) {
  const { project, compact = false, hideProperties = false, className, wrapProperties = false } = props;
  // states
  const [deleteProjectModalOpen, setDeleteProjectModal] = useState(false);
  const [joinProjectModalOpen, setJoinProjectModal] = useState(false);
  const [restoreProject, setRestoreProject] = useState(false);
  const [isActionMenuOpen, setActionMenuOpen] = useState(false);
  // refs
  const projectCardRef = useRef(null);
  // router
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  // store hooks
  const { addProjectToFavorites, removeProjectFromFavorites } = useProject();
  const { allowPermissions } = useUserPermissions();
  const shouldRenderFavorite = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  // auth
  const isMemberOfProject = !!project.member_role;
  const hasAdminRole = project.member_role === EUserPermissions.ADMIN;
  const hasMemberRole = project.member_role === EUserPermissions.MEMBER;
  // archive
  const isArchived = !!project.archived_at;
  // local storage
  const { setValue: toggleFavoriteMenu, storedValue: isFavoriteMenuOpen } = useLocalStorage<boolean>(
    IS_FAVORITE_MENU_OPEN,
    false
  );

  const handleAddToFavorites = () => {
    if (!workspaceSlug) return;

    const addToFavoritePromise = addProjectToFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(addToFavoritePromise, {
      loading: translate("web.adding_project_to_favorites"),
      success: {
        title: translate("toast.success"),
        message: () => translate("project_added_to_favorites"),
        // propel: the callback exists for its side effect; a toast action is data, and there is
        // none here, so it returns an empty list rather than an empty fragment.
        actionItems: () => {
          if (!isFavoriteMenuOpen) toggleFavoriteMenu(true);
          return [];
        },
      },
      error: {
        title: translate("toast.error"),
        message: () => translate("couldnt_add_the_project_to_favorites"),
      },
    });
  };

  const handleRemoveFromFavorites = () => {
    if (!workspaceSlug) return;

    const removeFromFavoritePromise = removeProjectFromFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(removeFromFavoritePromise, {
      loading: translate("web.removing_project_from_favorites"),
      success: {
        title: translate("toast.success"),
        message: () => translate("project_removed_from_favorites"),
      },
      error: {
        title: translate("toast.error"),
        message: () => translate("couldnt_remove_the_project_from_favorites"),
      },
    });
  };

  const projectLink = `${workspaceSlug}/projects/${project.id}/issues`;
  const handleCopyText = () =>
    copyUrlToClipboard(projectLink).then(() =>
      setToast({
        type: "info",
        title: translate("web.link_copied"),
        message: translate("web.project_link_copied_to_clipboard"),
      })
    );
  const handleOpenInNewTab = () => window.open(`/${projectLink}`, "_blank");

  const MENU_ITEMS: TContextMenuItem[] = [
    {
      key: "settings",
      action: () => router.push(`/${workspaceSlug}/settings/projects/${project.id}`),
      title: translate("web.settings"),
      icon: SettingsOutline,
      shouldRender: !isArchived && (hasAdminRole || hasMemberRole),
    },
    {
      key: "join",
      action: () => setJoinProjectModal(true),
      title: translate("web.join"),
      icon: UserPlusOutline,
      shouldRender: !isMemberOfProject && !isArchived,
    },
    {
      key: "open-new-tab",
      action: handleOpenInNewTab,
      title: translate("web.open_in_new_tab"),
      icon: NewTabOutline,
      shouldRender: !isMemberOfProject && !isArchived,
    },
    {
      key: "copy-link",
      action: () => void handleCopyText(),
      title: translate("web.copy_link"),
      icon: LinkOutline,
      shouldRender: !isArchived,
    },
    {
      key: "restore",
      action: () => setRestoreProject(true),
      title: translate("web.restore"),
      icon: RestoreOutline,
      shouldRender: isArchived && hasAdminRole,
    },
    {
      key: "delete",
      action: () => setDeleteProjectModal(true),
      title: translate("web.delete"),
      icon: DeleteOutline,
      shouldRender: isArchived && hasAdminRole,
    },
  ];

  return (
    <>
      {/* Delete Project Modal */}
      <DeleteProjectModal
        project={project}
        isOpen={deleteProjectModalOpen}
        onClose={() => setDeleteProjectModal(false)}
      />
      {/* Join Project Modal */}
      {workspaceSlug && (
        <JoinProjectModal
          workspaceSlug={workspaceSlug.toString()}
          project={project}
          isOpen={joinProjectModalOpen}
          handleClose={() => setJoinProjectModal(false)}
        />
      )}
      {/* Restore project modal */}
      {workspaceSlug && project && (
        <ArchiveRestoreProjectModal
          workspaceSlug={workspaceSlug.toString()}
          projectId={project.id}
          isOpen={restoreProject}
          onClose={() => setRestoreProject(false)}
          archive={false}
        />
      )}
      <Link
        ref={projectCardRef}
        href={`/${workspaceSlug}/projects/${project.id}/issues`}
        onClick={(e) => {
          if (!isMemberOfProject || isArchived) {
            e.preventDefault();
            e.stopPropagation();
            if (!isArchived) setJoinProjectModal(true);
          }
        }}
        data-prevent-progress={!isMemberOfProject || isArchived}
        data-project-card={project.id}
        data-compact={compact}
        className={cn(
          "group/project-card focus-visible:outline-accent-primary relative flex w-full min-w-0 flex-col rounded-xl border border-subtle bg-layer-1 p-1 shadow-none transition-colors hover:bg-layer-1-hover focus-visible:outline-2",
          compact &&
            "flex-row! items-center gap-3 rounded-none border-x-0 border-t-0 border-b border-subtle bg-layer-2 px-3 py-1 hover:bg-layer-1",
          className
        )}
      >
        <ContextMenu parentRef={projectCardRef} items={MENU_ITEMS} />
        <div
          className={cn(
            "relative h-[108px] shrink-0 overflow-hidden rounded-lg bg-[#262626]",
            compact && "size-9! rounded-md bg-layer-1"
          )}
        >
          {project.cover_image_url && !compact && (
            <CoverImage
              src={project.cover_image_url}
              alt=""
              className="absolute inset-0 h-full w-full scale-[1.02] opacity-95 blur-[1px]"
            />
          )}
          <div
            style={getIconBackgroundStyle(project.logo_props)}
            className={cn(
              "absolute top-3 left-3 grid size-9 place-items-center rounded-md bg-white/10",
              compact && "inset-0"
            )}
          >
            <ProjectLogo background={false} logo={project.logo_props} size={20} />
          </div>
        </div>
        <div className={cn("min-w-0 px-2 pt-1.5", compact && "flex-1 p-0!")}>
          <Tooltip label={project.description || project.name} disabled={!project.description}>
            <h3 className="truncate text-14 font-medium text-primary">{project.name}</h3>
          </Tooltip>
          <span className="flex items-center gap-1.5 text-12 text-tertiary">
            {project.identifier}
            {project.network === 0 && <LockOutline className="size-3" />}
          </span>
        </div>
        <div
          role="presentation"
          data-project-actions
          className={cn(
            "absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-md bg-layer-2/80 opacity-0 transition-opacity group-focus-within/project-card:opacity-100 group-hover/project-card:opacity-100 [@media(hover:none)]:opacity-100",
            isActionMenuOpen && "opacity-100",
            compact && "static order-last opacity-100"
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Menu open={isActionMenuOpen} onOpenChange={setActionMenuOpen}>
            <MenuTrigger
              render={
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={translate("aria_labels.common.more_actions")}
                  icon={<MoreHorizontal className="size-4" />}
                />
              }
            />
            {isMemberOfProject && !isArchived ? (
              <SidebarProjectQuickActions
                workspaceSlug={String(workspaceSlug)}
                project={project}
                onCopyLink={() => void handleCopyText()}
              />
            ) : (
              <ActionMenuContent side="bottom" align="end">
                {MENU_ITEMS.filter((item) => item.shouldRender !== false).map((item) => (
                  <MenuItem
                    key={item.key}
                    label={item.title ?? ""}
                    icon={item.icon ? <Icon icon={item.icon} /> : undefined}
                    onClick={item.action}
                  />
                ))}
              </ActionMenuContent>
            )}
          </Menu>
          {!isArchived && shouldRenderFavorite && (
            <FavoriteStar
              aria-label={translate(project.is_favorite ? "remove_from_favorites" : "add_to_favorites")}
              buttonClassName="size-6 rounded-md hover:bg-layer-1"
              iconClassName="size-4"
              selected={!!project.is_favorite}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (project.is_favorite) handleRemoveFromFavorites();
                else handleAddToFavorites();
              }}
            />
          )}
        </div>
        <div
          className={cn(
            "flex min-w-0 items-center gap-1 px-2 py-1.5",
            wrapProperties && "flex-wrap gap-2",
            hideProperties && "hidden!",
            compact && "ml-auto shrink-0 justify-end p-0! max-sm:hidden"
          )}
        >
          <div className={cn("flex min-w-0 items-center", !wrapProperties && "max-w-20 shrink-0")}>
            <ProjectStatusSelect
              workspaceSlug={String(workspaceSlug)}
              projectId={project.id}
              value={project.status}
              disabled={
                isArchived ||
                !(hasAdminRole || allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE))
              }
            />
          </div>
          <ProjectCardProperties
            project={project}
            wrap={wrapProperties}
            stretch={!compact}
            disabled={
              isArchived ||
              !(hasAdminRole || allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE))
            }
          />

          {isArchived ? (
            <span className="text-12 text-tertiary">{translate("web.archived")}</span>
          ) : (
            !isMemberOfProject && (
              <Button
                variant="ghost"
                size="xs"
                stretch="auto"
                label={translate("web.join")}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setJoinProjectModal(true);
                }}
              />
            )
          )}
        </div>
      </Link>
    </>
  );
});
