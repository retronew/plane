/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import { Outlet } from "react-router";
import useSWR from "swr";
// components
import { PROFILE_VIEWER_TAB, PROFILE_ADMINS_TAB, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { CssTransition } from "@/components/core/css-transition";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { useProfileSidebar } from "@/components/profile/use-profile-sidebar";
import { ProfileSidebar } from "@/components/profile/sidebar";
// constants
import { USER_PROFILE_PROJECT_SEGREGATION } from "@plane/constants";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import useSize from "@/hooks/use-window-size";
// local components
import { UserService } from "@/services/user.service";
import type { Route } from "./+types/layout";
import { UserProfileHeader } from "./header";
import { ProfileIssuesMobileHeader } from "./mobile-header";
import { ProfileNavbar } from "./navbar";

const userService = new UserService();

function UseProfileLayout({ params }: Route.ComponentProps) {
  // router
  const { workspaceSlug, userId } = params;
  const pathname = usePathname();
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();
  // derived values
  const isAuthorized = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  const windowSize = useSize();
  const isDesktop = windowSize[0] >= 768;
  const sidebar = useProfileSidebar(isDesktop);

  const { data: userProjectsData } = useSWR(USER_PROFILE_PROJECT_SEGREGATION(workspaceSlug, userId), () =>
    userService.getUserProfileProjectsSegregation(workspaceSlug, userId)
  );
  // derived values
  const isAuthorizedPath =
    pathname.includes("assigned") || pathname.includes("created") || pathname.includes("subscribed");
  const isIssuesTab = pathname.includes("assigned") || pathname.includes("created") || pathname.includes("subscribed");

  const tabsList = isAuthorized ? [...PROFILE_VIEWER_TAB, ...PROFILE_ADMINS_TAB] : PROFILE_VIEWER_TAB;
  const currentTab = tabsList.find((tab) => pathname === `/${workspaceSlug}/profile/${userId}${tab.selected}`);

  return (
    <>
      {/* Passing the type prop from the current route value as we need the header as top most component.
            TODO: We are depending on the route path to handle the mobile header type. If the path changes, this logic will break. */}
      <div className="flex h-full w-full flex-col overflow-hidden md:flex-row">
        <div className="flex h-full w-full flex-col overflow-hidden">
          <AppHeader
            header={
              <UserProfileHeader
                type={currentTab?.i18n_label}
                userProjectsData={userProjectsData}
                showProfileIssuesFilter={isIssuesTab}
                sidebarOpen={sidebar.open}
                toggleSidebar={sidebar.toggle}
              />
            }
            mobileHeader={isIssuesTab && <ProfileIssuesMobileHeader />}
          />
          <ContentWrapper>
            <div className="relative flex h-full w-full flex-row overflow-hidden md:flex-col">
              <div className="flex w-full flex-col md:h-full md:overflow-hidden">
                <ProfileNavbar isAuthorized={!!isAuthorized} />
                {isAuthorized || !isAuthorizedPath ? (
                  <div className={`h-full w-full overflow-hidden`}>
                    <Outlet />
                  </div>
                ) : (
                  <div className="grid h-full w-full place-items-center text-secondary">
                    {t("you_do_not_have_the_permission_to_access_this_page")}
                  </div>
                )}
              </div>
              {!isDesktop && (
                <CssTransition
                  show={sidebar.open}
                  transitionClassName="absolute inset-0 z-5 h-full w-full transition-all duration-300 ease-in-out motion-reduce:transition-none"
                  fromClassName="translate-x-full opacity-0"
                  toClassName="translate-x-0 opacity-100"
                  enterClassName=""
                  leaveClassName=""
                  leaveDurationMs={300}
                >
                  <ProfileSidebar userProjectsData={userProjectsData} closeMobile={sidebar.closeMobile} />
                </CssTransition>
              )}
            </div>
          </ContentWrapper>
        </div>
        {isDesktop && (
          <CssTransition
            show={sidebar.open}
            transitionClassName="h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none"
            fromClassName="w-0 translate-x-full opacity-0"
            toClassName="w-[300px] translate-x-0 opacity-100"
            enterClassName=""
            leaveClassName=""
            leaveDurationMs={300}
          >
            <ProfileSidebar userProjectsData={userProjectsData} />
          </CssTransition>
        )}
      </div>
    </>
  );
}

export default observer(UseProfileLayout);
