/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useOutsideClickDetector } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
import { EditOutline } from "@makeplane/propel/icons";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IUserProfileProjectSegregation } from "@plane/types";
import { Loader } from "@plane/blocks/skeleton";
import { cn, renderFormattedDate, getFileURL } from "@plane/utils";
// components
import { CoverImage } from "@/components/common/cover-image";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useUser } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
// components
import { ProfileSidebarTime } from "./time";
import { ProfileProjectProgress } from "./project-progress";
import styles from "./sidebar.module.css";

type TProfileSidebar = {
  userProjectsData: IUserProfileProjectSegregation | undefined;
  className?: string;
};

export const ProfileSidebar = observer(function ProfileSidebar(props: TProfileSidebar) {
  const { userProjectsData, className = "" } = props;
  // refs
  const ref = useRef<HTMLDivElement>(null);
  // router
  const { userId } = useParams();
  // store hooks
  const { data: currentUser } = useUser();
  const { profileSidebarCollapsed, toggleProfileSidebar } = useAppTheme();
  const { getProjectById } = useProject();
  const { toggleProfileSettingsModal } = useCommandPalette();
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  // derived values
  const userData = userProjectsData?.user_data;

  useOutsideClickDetector(ref, () => {
    if (profileSidebarCollapsed === false) {
      if (window.innerWidth < 768) {
        toggleProfileSidebar();
      }
    }
  });

  const userDetails = [
    {
      i18n_label: "profile.details.joined_on",
      value: renderFormattedDate(userData?.date_joined ?? ""),
    },
    {
      i18n_label: "profile.details.time_zone",
      value: <ProfileSidebarTime timeZone={userData?.user_timezone} />,
    },
  ];

  useEffect(() => {
    const handleToggleProfileSidebar = () => {
      if (window && window.innerWidth < 768) {
        toggleProfileSidebar(true);
      }
      if (window && profileSidebarCollapsed && window.innerWidth >= 768) {
        toggleProfileSidebar(false);
      }
    };

    window.addEventListener("resize", handleToggleProfileSidebar);
    handleToggleProfileSidebar();
    return () => window.removeEventListener("resize", handleToggleProfileSidebar);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- register the resize listener once
  }, []);

  return (
    <div
      className={cn(
        `vertical-scrollbar fixed z-5 flex h-full w-full shrink-0 flex-col overflow-hidden border-l border-subtle bg-surface-1 transition-[margin-left] motion-reduce:transition-none md:relative md:w-[300px]`,
        className
      )}
      style={profileSidebarCollapsed ? { marginLeft: "100vw" } : {}}
    >
      {userProjectsData ? (
        <>
          <div className="relative h-[110px] shrink-0">
            {currentUser?.id === userId && (
              <div className="absolute top-3.5 right-3.5">
                <IconButton
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon={EditOutline} />}
                  aria-label={t("common.edit")}
                  onClick={() =>
                    toggleProfileSettingsModal({
                      activeTab: "general",
                      isOpen: true,
                    })
                  }
                />
              </div>
            )}
            <CoverImage
              src={userData?.cover_image_url ?? undefined}
              alt={userData?.display_name}
              className="h-[110px] w-full"
            />
            <div className="absolute -bottom-[26px] left-5 size-[52px] overflow-hidden rounded-full">
              {userData?.avatar_url && userData?.avatar_url !== "" ? (
                <img
                  src={getFileURL(userData?.avatar_url)}
                  alt={userData?.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent-primary text-on-color capitalize">
                  {userData?.first_name?.[0]}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 px-5">
            <div className="mt-[38px]">
              <h4 className="text-h6-semibold">
                {userData?.first_name} {userData?.last_name}
              </h4>
              <h6 className="text-13 text-secondary">({userData?.display_name})</h6>
            </div>
            <div className="mt-6 space-y-4">
              {userDetails.map((detail) => (
                <div
                  key={detail.i18n_label}
                  className="grid grid-cols-[2fr_3fr] items-center gap-4 text-body-xs-regular"
                >
                  <div className="min-w-0 text-secondary">{t(detail.i18n_label)}</div>
                  <div className="min-w-0 font-medium break-words">{detail.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="vertical-scrollbar mt-9 min-h-0 flex-1 overflow-y-auto px-5">
            <div className="space-y-1">
              {userProjectsData.project_data.map((project) => {
                const projectDetails = getProjectById(project.id);

                const totalIssues =
                  project.created_issues + project.assigned_issues + project.pending_issues + project.completed_issues;

                const completedIssuePercentage =
                  project.assigned_issues === 0
                    ? 0
                    : Math.round((project.completed_issues / project.assigned_issues) * 100);

                if (!projectDetails) return null;

                return (
                  <div key={project.id} className={cn("-mx-2", styles.project)}>
                    <Collapsible
                      placement="sidebar"
                      icon={
                        <span className="grid size-4 shrink-0 place-items-center">
                          <Logo logo={projectDetails.logo_props} />
                        </span>
                      }
                      trigger={
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span className="truncate text-body-xs-medium break-words">{projectDetails.name}</span>
                          {project.assigned_issues > 0 && (
                            <Tooltip label={t("web.completion_percentage")} side="left" disabled={isMobile}>
                              <span
                                className={`rounded-sm px-1 py-0.5 text-11 font-medium ${
                                  completedIssuePercentage <= 35
                                    ? "bg-danger-subtle text-danger-primary"
                                    : completedIssuePercentage <= 70
                                      ? "bg-yellow-500/10 text-yellow-500"
                                      : "bg-success-subtle text-success-primary"
                                }`}
                              >
                                {completedIssuePercentage}%
                              </span>
                            </Tooltip>
                          )}
                        </span>
                      }
                    >
                      <div className="mt-3 px-2 pb-2">
                        {totalIssues > 0 && (
                          <ProfileProjectProgress
                            created={project.created_issues}
                            assigned={project.assigned_issues}
                            pending={project.pending_issues}
                            completed={project.completed_issues}
                          />
                        )}
                        <div className="mt-2 space-y-2.5 text-body-xs-regular text-secondary">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-xs bg-[#203b80]" />
                              {t("web.created")}
                            </div>
                            <div className="font-medium">
                              {project.created_issues} {t("issues")}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-xs bg-[#3f76ff]" />
                              {t("web.assigned")}
                            </div>
                            <div className="font-medium">
                              {project.assigned_issues} {t("issues")}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-xs bg-[#f59e0b]" />
                              {t("web.due")}
                            </div>
                            <div className="font-medium">
                              {project.pending_issues} {t("issues")}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-xs bg-[#16a34a]" />
                              {t("web.completed")}
                            </div>
                            <div className="font-medium">
                              {project.completed_issues} {t("issues")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <Loader className="space-y-7 px-5">
          <Loader.Item height="130px" />
          <div className="space-y-5">
            <Loader.Item height="20px" />
            <Loader.Item height="20px" />
            <Loader.Item height="20px" />
            <Loader.Item height="20px" />
            <Loader.Item height="20px" />
          </div>
        </Loader>
      )}
    </div>
  );
});
