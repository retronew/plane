import { useCanCreateProject } from "@/hooks/use-can-create-project";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
// mobx
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar } from "@makeplane/propel/components/avatar";
import { ArrowRight, Check, Clock3, FolderPlus, Settings2, Users } from "lucide-react";
// plane ui
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { getFileURL } from "@plane/utils";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser, useUserPermissions } from "@/hooks/store/user";
// plane web constants

export const NoProjectsEmptyState = observer(function NoProjectsEmptyState() {
  // navigation
  const { workspaceSlug } = useParams();
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { toggleCreateProjectModal, toggleProfileSettingsModal } = useCommandPalette();
  const { joinedProjectIds } = useProject();
  const { data: currentUser } = useUser();
  const { currentWorkspace: activeWorkspace } = useWorkspace();
  // local storage
  const { storedValue, setValue } = useLocalStorage(`quickstart-guide-${workspaceSlug}`, {
    hide: false,
    visited_members: false,
    visited_workspace: false,
    visited_profile: false,
  });
  const { t } = useTranslation();
  // derived values
  const canCreateProject = useCanCreateProject();
  const isWorkspaceAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  const EMPTY_STATE_DATA = [
    {
      id: "create-project",
      title: "home.empty.create_project.title",
      description: "home.empty.create_project.description",
      icon: <FolderPlus className="size-4" />,
      flag: "projects",
      cta: {
        text: "home.empty.create_project.cta",
        onClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          if (!canCreateProject) return;
          e.preventDefault();
          e.stopPropagation();
          toggleCreateProjectModal(true);
        },
        disabled: !canCreateProject,
      },
    },
    {
      id: "invite-team",
      title: "home.empty.invite_team.title",
      description: "home.empty.invite_team.description",
      icon: <Users className="size-4" />,
      flag: "visited_members",
      cta: {
        text: "home.empty.invite_team.cta",
        link: `/${workspaceSlug}/settings/members`,
        disabled: !isWorkspaceAdmin,
      },
    },
    {
      id: "configure-workspace",
      title: "home.empty.configure_workspace.title",
      description: "home.empty.configure_workspace.description",
      icon: <Settings2 className="size-4" />,
      flag: "visited_workspace",
      cta: {
        text: "home.empty.configure_workspace.cta",
        link: "settings",
        disabled: !isWorkspaceAdmin,
      },
    },
    {
      id: "personalize-account",
      title: "home.empty.personalize_account.title",
      description: "home.empty.personalize_account.description",
      icon: (
        <Link href={`/${workspaceSlug}/profile/${currentUser?.id}`} aria-label={currentUser?.display_name}>
          <Avatar
            size="lg"
            src={getFileURL(currentUser?.avatar_url ?? "")}
            alt={currentUser?.display_name ?? ""}
            fallback={(currentUser?.display_name ?? currentUser?.email ?? "?")[0]}
          />
        </Link>
      ),
      flag: "visited_profile",
      cta: {
        text: "home.empty.personalize_account.cta",
        onClick: () => {
          if (storedValue) setValue({ ...storedValue, visited_profile: true });
          toggleProfileSettingsModal({ activeTab: "general", isOpen: true });
        },
        disabled: false,
      },
    },
  ];
  const isComplete = (type: string) => {
    switch (type) {
      case "projects":
        return joinedProjectIds?.length > 0;
      case "visited_members":
        return (activeWorkspace?.total_members || 0) >= 2;
      case "visited_workspace":
        return storedValue?.visited_workspace;
      case "visited_profile":
        return storedValue?.visited_profile;
    }
  };

  if (storedValue?.hide || (joinedProjectIds?.length > 0 && (activeWorkspace?.total_members || 0) >= 2)) return null;

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div className="text-14 font-semibold text-tertiary">{t("home.empty.quickstart_guide")}</div>
        <button
          type="button"
          className="-mr-2 -mb-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-12 font-medium text-tertiary transition-colors duration-150 outline-none hover:bg-layer-1-hover hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-strong motion-reduce:transition-none"
          onClick={() => {
            if (!storedValue) return;
            setValue({ ...storedValue, hide: true });
          }}
        >
          <Clock3 className="size-3.5" aria-hidden="true" />
          {t("home.empty.not_right_now")}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {EMPTY_STATE_DATA.map((item) => {
          const isStateComplete = isComplete(item.flag);
          return (
            <div
              key={item.id}
              className="group flex min-h-36 flex-col rounded-xl border border-subtle bg-surface-1 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[background-color,box-shadow] duration-200 hover:bg-layer-1 hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] motion-reduce:transition-none dark:border-subtle-1 dark:bg-layer-1 dark:shadow-none dark:hover:bg-layer-1-hover dark:hover:shadow-none"
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className={
                    item.id === "personalize-account"
                      ? "grid size-8 shrink-0 place-items-center"
                      : "grid size-8 shrink-0 place-items-center rounded-lg border border-subtle bg-layer-1 text-secondary"
                  }
                >
                  {item.icon}
                </div>
                {isStateComplete && <Check className="size-3.5 text-tertiary" aria-label={t("common.completed")} />}
              </div>
              <h3 className="mb-1 text-13 font-medium text-primary">{t(item.title)}</h3>
              <p className="mb-4 text-12 leading-5 text-tertiary">{t(item.description)}</p>
              {!isStateComplete &&
                !item.cta.disabled &&
                (item.cta.link ? (
                  <Link
                    href={item.cta.link}
                    onClick={(e) => {
                      if (!storedValue) {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      setValue({
                        ...storedValue,
                        [item.flag]: true,
                      });
                    }}
                    className="mt-auto flex w-fit items-center gap-1.5 rounded-sm text-12 font-medium text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-strong"
                  >
                    {t(item.cta.text)}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="mt-auto flex w-fit items-center gap-1.5 rounded-sm text-left text-12 font-medium text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-strong"
                    onClick={item.cta.onClick}
                  >
                    {t(item.cta.text)}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});
