/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
// components
import { AppLoader } from "@/components/common/app-loader";
// helpers
import { isValidNextPath } from "@plane/utils";
import { EPageTypes } from "@/helpers/authentication.helper";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser, useUserProfile, useUserSettings } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

type TPageType = EPageTypes;

type TAuthenticationWrapper = {
  children: ReactNode;
  pageType?: TPageType;
};

// Delegates to the shared isValidNextPath (@plane/utils) instead of a local
// reimplementation. A from-scratch version here previously resolved the
// value against location.origin and required the result to stay
// same-origin — which has its own gap: a next_path like "http:evil.com"
// resolves AS IF relative whenever the input's scheme happens to match the
// real origin's own scheme, e.g. any self-hosted deployment actually
// serving over plain http (verified directly: this bypasses the
// location.origin-based check on an http:// origin, though not on https://,
// since the schemes then differ). isValidNextPath closes this by requiring
// a literal leading "/" (and rejecting "//") before any URL-based
// comparison, so it doesn't depend on which scheme the real origin happens
// to use.
const isValidURL = isValidNextPath;

type TAuthenticationState = {
  pathname: string;
  nextPath: string | null;
  pageType: TPageType;
  isUserLoading: boolean;
  isUserSWRLoading: boolean;
  workspacesLoader: boolean;
  isUserOnboard: boolean;
  currentUser: ReturnType<typeof useUser>["data"];
  currentUserProfile: ReturnType<typeof useUserProfile>["data"];
  currentUserSettings: ReturnType<typeof useUserSettings>["data"];
  workspaces: ReturnType<typeof useWorkspace>["workspaces"];
};

type TAuthenticationOutcome =
  | { type: "loader" }
  | { type: "children" }
  | { type: "redirect"; method: "push" | "replace"; url: string };

const getRedirectOutcome = (method: "push" | "replace", url: string): TAuthenticationOutcome => ({
  type: "redirect",
  method,
  url,
});

const isUserOnboarded = (profile: TAuthenticationState["currentUserProfile"] | undefined): boolean => {
  if (profile?.is_onboarded) return true;
  return Boolean(
    profile?.onboarding_step?.profile_complete &&
    profile?.onboarding_step?.workspace_create &&
    profile?.onboarding_step?.workspace_invite &&
    profile?.onboarding_step?.workspace_join
  );
};

const getUnauthenticatedRedirectUrl = (pathname: string): string => `/${pathname ? `?next_path=${pathname}` : ``}`;

const getWorkspaceRedirectionUrl = (state: TAuthenticationState): string => {
  const { nextPath, currentUserSettings, workspaces } = state;

  // validating the nextPath from the router query
  if (nextPath && isValidURL(nextPath)) return nextPath;

  // validate the last and fallback workspace_slug
  const currentWorkspaceSlug =
    currentUserSettings?.workspace?.last_workspace_slug || currentUserSettings?.workspace?.fallback_workspace_slug;

  // validate the current workspace_slug is available in the user's workspace list
  const isCurrentWorkspaceValid = Object.values(workspaces || {}).findIndex(
    (workspace) => workspace.slug === currentWorkspaceSlug
  );

  if (isCurrentWorkspaceValid >= 0) return `/${currentWorkspaceSlug}`;

  return "/create-workspace";
};

const resolveNonAuthenticatedOutcome = (state: TAuthenticationState): TAuthenticationOutcome => {
  if (!state.currentUser?.id) return { type: "children" };
  if (state.currentUserProfile?.id && state.isUserOnboard)
    return getRedirectOutcome("push", getWorkspaceRedirectionUrl(state));
  return getRedirectOutcome("push", "/onboarding");
};

const resolveOnboardingOutcome = (state: TAuthenticationState): TAuthenticationOutcome => {
  if (!state.currentUser?.id) return getRedirectOutcome("push", getUnauthenticatedRedirectUrl(state.pathname));
  if (state.currentUserProfile?.id && state.isUserOnboard)
    return getRedirectOutcome("replace", getWorkspaceRedirectionUrl(state));
  return { type: "children" };
};

const resolveSetPasswordOutcome = (state: TAuthenticationState): TAuthenticationOutcome => {
  if (!state.currentUser?.id) return getRedirectOutcome("push", getUnauthenticatedRedirectUrl(state.pathname));
  if (!state.currentUser?.is_password_autoset && state.currentUserProfile?.id && state.isUserOnboard)
    return getRedirectOutcome("push", getWorkspaceRedirectionUrl(state));
  return { type: "children" };
};

const resolveAuthenticatedOutcome = (state: TAuthenticationState): TAuthenticationOutcome => {
  if (!state.currentUser?.id) return getRedirectOutcome("push", getUnauthenticatedRedirectUrl(state.pathname));
  if (state.currentUserProfile?.id && state.isUserOnboard) return { type: "children" };
  return getRedirectOutcome("push", "/onboarding");
};

const resolvePageTypeOutcome = (state: TAuthenticationState): TAuthenticationOutcome => {
  switch (state.pageType) {
    case EPageTypes.NON_AUTHENTICATED:
      return resolveNonAuthenticatedOutcome(state);
    case EPageTypes.ONBOARDING:
      return resolveOnboardingOutcome(state);
    case EPageTypes.SET_PASSWORD:
      return resolveSetPasswordOutcome(state);
    case EPageTypes.AUTHENTICATED:
      return resolveAuthenticatedOutcome(state);
    default:
      return { type: "children" };
  }
};

const resolveAuthenticationOutcome = (state: TAuthenticationState): TAuthenticationOutcome => {
  if ((state.isUserSWRLoading || state.isUserLoading || state.workspacesLoader) && !state.currentUser?.id)
    return { type: "loader" };
  if (state.pageType === EPageTypes.PUBLIC) return { type: "children" };
  return resolvePageTypeOutcome(state);
};

export const AuthenticationWrapper = observer(function AuthenticationWrapper(props: TAuthenticationWrapper) {
  const pathname = usePathname();
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next_path");
  // props
  const { children, pageType = EPageTypes.AUTHENTICATED } = props;
  // hooks
  const { isLoading: isUserLoading, data: currentUser, fetchCurrentUser } = useUser();
  const { data: currentUserProfile } = useUserProfile();
  const { data: currentUserSettings } = useUserSettings();
  const { loader: workspacesLoader, workspaces } = useWorkspace();

  const { isLoading: isUserSWRLoading } = useSWR("USER_INFORMATION", async () => await fetchCurrentUser(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const isUserOnboard = isUserOnboarded(currentUserProfile);

  const outcome = resolveAuthenticationOutcome({
    pathname,
    nextPath,
    pageType,
    isUserLoading,
    isUserSWRLoading,
    workspacesLoader,
    isUserOnboard,
    currentUser,
    currentUserProfile,
    currentUserSettings,
    workspaces,
  });

  if (outcome.type === "loader")
    return <AppLoader className="relative flex h-screen w-full items-center justify-center" />;

  if (outcome.type === "redirect") {
    router[outcome.method](outcome.url);
    return <></>;
  }

  return <>{children}</>;
});
