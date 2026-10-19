/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
// ui
import { LogOutOutline } from "@makeplane/propel/icons";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import { PlaneLogo } from "@plane/blocks/icons";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
// assets
import WorkSpaceNotAvailable from "@/app/assets/workspace/workspace-not-available.png?url";
// components
import { AppLoader } from "@/components/common/app-loader";
// constants
import {
  WORKSPACE_MEMBERS,
  WORKSPACE_PARTIAL_PROJECTS,
  WORKSPACE_MEMBER_ME_INFORMATION,
  WORKSPACE_PROJECTS_ROLES_INFORMATION,
  WORKSPACE_FAVORITE,
  WORKSPACE_STATES,
  WORKSPACE_SIDEBAR_PREFERENCES,
  WORKSPACE_PROJECT_NAVIGATION_PREFERENCES,
} from "@plane/constants";
// hooks
import { useFavorite } from "@/hooks/store/use-favorite";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { translate } from "@plane/i18n";
// types
import type { IWorkspace, IWorkspaceMemberMe } from "@plane/types";

interface IWorkspaceAuthWrapper {
  children: ReactNode;
  isLoading?: boolean;
}

type TWorkspaceSlug = string | string[] | undefined;

type TWorkspaceAuthFetchers = {
  fetchUserWorkspaceInfo: ReturnType<typeof useUserPermissions>["fetchUserWorkspaceInfo"];
  fetchUserProjectPermissions: ReturnType<typeof useUserPermissions>["fetchUserProjectPermissions"];
  fetchPartialProjects: ReturnType<typeof useProject>["fetchPartialProjects"];
  fetchWorkspaceMembers: ReturnType<typeof useMember>["workspace"]["fetchWorkspaceMembers"];
  fetchFavorite: ReturnType<typeof useFavorite>["fetchFavorite"];
  fetchWorkspaceStates: ReturnType<typeof useProjectState>["fetchWorkspaceStates"];
  fetchSidebarNavigationPreferences: ReturnType<typeof useWorkspace>["fetchSidebarNavigationPreferences"];
  fetchProjectNavigationPreferences: ReturnType<typeof useWorkspace>["fetchProjectNavigationPreferences"];
};

type TWorkspaceAuthFetchesProps = {
  workspaceSlug: TWorkspaceSlug;
  hasCurrentWorkspace: boolean;
  canPerformWorkspaceMemberActions: boolean;
  fetchers: TWorkspaceAuthFetchers;
};

const SWR_OPTIONS = { revalidateIfStale: false, revalidateOnFocus: false };

const getSlugString = (workspaceSlug: TWorkspaceSlug): string | null => {
  if (!workspaceSlug) return null;
  return workspaceSlug.toString();
};

const getFetchSlug = (workspaceSlug: TWorkspaceSlug, hasCurrentWorkspace: boolean): string | null => {
  if (!workspaceSlug || !hasCurrentWorkspace) return null;
  return workspaceSlug.toString();
};

const createFetcher = <T,>(slug: string | null, fetch: (slug: string) => T): (() => T) | null =>
  slug === null ? null : () => fetch(slug);

const getAllWorkspaces = (workspaces: Record<string, IWorkspace> | undefined): IWorkspace[] | undefined => {
  if (!workspaces) return undefined;
  return Object.values(workspaces);
};

const getCurrentWorkspace = (allWorkspaces: IWorkspace[] | undefined, workspaceSlug: TWorkspaceSlug) => {
  if (!allWorkspaces) return undefined;
  return allWorkspaces.find((workspace) => workspace?.slug === workspaceSlug);
};

const getCurrentWorkspaceInfo = (
  workspaceSlug: TWorkspaceSlug,
  getWorkspaceInfo: (workspaceSlug: string) => IWorkspaceMemberMe | undefined
) => {
  if (!workspaceSlug) return workspaceSlug;
  return getWorkspaceInfo(workspaceSlug.toString());
};

const useWorkspaceAuthFetches = (props: TWorkspaceAuthFetchesProps) => {
  const { workspaceSlug, hasCurrentWorkspace, canPerformWorkspaceMemberActions, fetchers } = props;
  const slug = getSlugString(workspaceSlug);
  const fetchSlug = getFetchSlug(workspaceSlug, hasCurrentWorkspace);
  const favoriteSlug = canPerformWorkspaceMemberActions ? fetchSlug : null;

  // fetching user workspace information
  useSWR(
    fetchSlug ? WORKSPACE_MEMBER_ME_INFORMATION(fetchSlug) : null,
    createFetcher(fetchSlug, fetchers.fetchUserWorkspaceInfo),
    SWR_OPTIONS
  );
  useSWR(
    fetchSlug ? WORKSPACE_PROJECTS_ROLES_INFORMATION(fetchSlug) : null,
    createFetcher(fetchSlug, fetchers.fetchUserProjectPermissions),
    SWR_OPTIONS
  );

  // fetching workspace projects
  useSWR(
    fetchSlug ? WORKSPACE_PARTIAL_PROJECTS(fetchSlug) : null,
    createFetcher(fetchSlug, fetchers.fetchPartialProjects),
    SWR_OPTIONS
  );
  // fetch workspace members
  useSWR(
    fetchSlug ? WORKSPACE_MEMBERS(fetchSlug) : null,
    createFetcher(fetchSlug, fetchers.fetchWorkspaceMembers),
    SWR_OPTIONS
  );
  // fetch workspace favorite
  useSWR(
    favoriteSlug ? WORKSPACE_FAVORITE(favoriteSlug) : null,
    createFetcher(favoriteSlug, fetchers.fetchFavorite),
    SWR_OPTIONS
  );
  // fetch workspace states
  useSWR(slug ? WORKSPACE_STATES(slug) : null, createFetcher(slug, fetchers.fetchWorkspaceStates), SWR_OPTIONS);

  // fetch workspace sidebar preferences
  useSWR(
    slug ? WORKSPACE_SIDEBAR_PREFERENCES(slug) : null,
    createFetcher(slug, fetchers.fetchSidebarNavigationPreferences),
    SWR_OPTIONS
  );

  // fetch workspace project navigation preferences
  useSWR(
    slug ? WORKSPACE_PROJECT_NAVIGATION_PREFERENCES(slug) : null,
    createFetcher(slug, fetchers.fetchProjectNavigationPreferences),
    SWR_OPTIONS
  );
};

type TWorkspaceNotFoundViewProps = {
  allWorkspaces: IWorkspace[] | undefined;
  currentUserEmail: string | undefined;
  isMobile: boolean;
  onSignOut: () => Promise<void>;
};

const WorkspaceNotFoundView = (props: TWorkspaceNotFoundViewProps) => {
  const { allWorkspaces, currentUserEmail, isMobile, onSignOut } = props;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-surface-2">
      <div className="relative container mx-auto flex h-full w-full flex-col overflow-hidden overflow-y-auto px-5 py-14 md:px-0">
        <div className="relative flex flex-shrink-0 items-center justify-between gap-4">
          <div className="z-10 flex-shrink-0 bg-surface-2 py-4">
            <PlaneLogo className="h-9 w-auto text-primary" />
          </div>
          <div className="relative flex items-center gap-2">
            <div className="text-13 font-medium">{currentUserEmail}</div>
            <Tooltip label={translate("web.sign_out")} alignOffset={8} disabled={isMobile}>
              <button
                type="button"
                aria-label={translate("web.sign_out")}
                className="relative flex h-6 w-6 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-sm hover:bg-layer-1"
                onClick={() => void onSignOut()}
              >
                <LogOutOutline width={14} height={14} />
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="relative flex h-full w-full flex-grow flex-col items-center justify-center space-y-3">
          <div className="relative flex-shrink-0">
            <img
              src={WorkSpaceNotAvailable}
              className="h-[220px] object-contain object-center"
              alt={translate("web.plane_logo")}
            />
          </div>
          <h3 className="text-center text-16 font-semibold">{translate("web.workspace_not_found")}</h3>
          <p className="text-center text-13 text-secondary">{translate("web.workspace_not_found_description")}</p>
          <div className="flex items-center justify-center gap-2 pt-4">
            {allWorkspaces && allWorkspaces.length > 0 && (
              <ButtonElement variant="primary" size="sm" stretch="auto" render={<Link href="/" />}>
                {translate("web.go_to_home")}
              </ButtonElement>
            )}
            {allWorkspaces && allWorkspaces.length > 0 && (
              <ButtonElement
                variant="secondary"
                size="sm"
                stretch="auto"
                render={<Link href="/settings/profile/general/" />}
              >
                {translate("web.visit_profile")}
              </ButtonElement>
            )}
            {allWorkspaces && allWorkspaces.length === 0 && (
              <ButtonElement variant="secondary" size="sm" stretch="auto" render={<Link href="/create-workspace/" />}>
                {translate("web.create_new_workspace")}
              </ButtonElement>
            )}
          </div>
        </div>

        <div className="absolute top-0 bottom-0 left-4 w-0 bg-layer-1 md:w-0.5" />
      </div>
    </div>
  );
};

const WorkspaceUnauthorizedView = () => (
  <div className={`h-screen w-full overflow-hidden bg-surface-1`}>
    <div className="grid h-full place-items-center p-4">
      <div className="space-y-8 text-center">
        <div className="space-y-2">
          <h3 className="text-16 font-semibold">{translate("web.not_authorized")}</h3>
          <p className="mx-auto w-1/2 text-13 text-secondary">{translate("web.not_a_member_description")}</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <ButtonElement variant="secondary" size="sm" stretch="auto" render={<Link href="/invitations" />}>
            {translate("web.check_pending_invites")}
          </ButtonElement>
          <ButtonElement variant="primary" size="sm" stretch="auto" render={<Link href="/create-workspace" />}>
            {translate("web.create_new_workspace")}
          </ButtonElement>
        </div>
      </div>
    </div>
  </div>
);

export const WorkspaceAuthWrapper = observer(function WorkspaceAuthWrapper(props: IWorkspaceAuthWrapper) {
  const { children, isLoading: isParentLoading = false } = props;
  // router params
  const { workspaceSlug } = useParams();
  // store hooks
  const { signOut, data: currentUser } = useUser();
  const { fetchPartialProjects } = useProject();
  const { fetchFavorite } = useFavorite();
  const {
    workspace: { fetchWorkspaceMembers },
  } = useMember();
  const { workspaces, fetchSidebarNavigationPreferences, fetchProjectNavigationPreferences } = useWorkspace();
  const { isMobile } = usePlatformOS();
  const { loader, workspaceInfoBySlug, fetchUserWorkspaceInfo, fetchUserProjectPermissions, allowPermissions } =
    useUserPermissions();
  const { fetchWorkspaceStates } = useProjectState();
  // derived values
  const canPerformWorkspaceMemberActions = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const allWorkspaces = getAllWorkspaces(workspaces);
  const currentWorkspace = getCurrentWorkspace(allWorkspaces, workspaceSlug);
  const currentWorkspaceInfo = getCurrentWorkspaceInfo(workspaceSlug, workspaceInfoBySlug);

  useWorkspaceAuthFetches({
    workspaceSlug,
    hasCurrentWorkspace: Boolean(currentWorkspace),
    canPerformWorkspaceMemberActions,
    fetchers: {
      fetchUserWorkspaceInfo,
      fetchUserProjectPermissions,
      fetchPartialProjects,
      fetchWorkspaceMembers,
      fetchFavorite,
      fetchWorkspaceStates,
      fetchSidebarNavigationPreferences,
      fetchProjectNavigationPreferences,
    },
  });

  const handleSignOut = async () => {
    await signOut().catch(() =>
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: translate("web.failed_to_sign_out_please_try_again"),
      })
    );
  };

  // if list of workspaces are not there then we have to render the spinner
  if (isParentLoading || allWorkspaces === undefined || loader) {
    return <AppLoader className="grid h-full place-items-center rounded-lg border border-subtle p-4" />;
  }

  // if workspaces are there and we are trying to access the workspace that we are not part of then show the existing workspaces
  if (currentWorkspace === undefined && !currentWorkspaceInfo) {
    return (
      <WorkspaceNotFoundView
        allWorkspaces={allWorkspaces}
        currentUserEmail={currentUser?.email}
        isMobile={isMobile}
        onSignOut={handleSignOut}
      />
    );
  }

  // while user does not have access to view that workspace
  if (currentWorkspaceInfo === undefined) {
    return <WorkspaceUnauthorizedView />;
  }

  return <>{children}</>;
});
