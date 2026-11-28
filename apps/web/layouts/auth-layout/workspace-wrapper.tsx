/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useContext, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import useSWR from "swr";
// ui
import { LogOutOutline } from "@makeplane/propel/icons";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import { preloadDetailedAsset } from "@plane/blocks/empty-state";
import { PlaneLogo } from "@plane/blocks/icons";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
// assets
import WorkSpaceNotAvailable from "@/app/assets/workspace/workspace-not-available.png?url";
// components
import { AppLoader } from "@/components/common/app-loader";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { usePlatformOS } from "@/hooks/use-platform-os";
import {
  hydrateWorkspaceBootstrap,
  readWorkspaceBootstrapCache,
  writeWorkspaceBootstrapCache,
} from "@/lib/bootstrap-cache";
import { StoreContext } from "@/lib/store-context";
import { bootstrapService } from "@/services/bootstrap.service";
import { translate } from "@plane/i18n";
// types
import type { IWorkspace, IWorkspaceMemberMe } from "@plane/types";

interface IWorkspaceAuthWrapper {
  children: ReactNode;
  isLoading?: boolean;
}

type TWorkspaceSlug = string | string[] | undefined;

const SWR_OPTIONS = { revalidateIfStale: false, revalidateOnFocus: false };
const CORE_EMPTY_STATE_ASSETS = ["cycle", "archived-cycle", "module", "view", "work-item", "draft"] as const;
let hasPreloadedCoreEmptyStates = false;

const getSlugString = (workspaceSlug: TWorkspaceSlug): string | null => {
  if (!workspaceSlug) return null;
  return workspaceSlug.toString();
};

const getFetchSlug = (workspaceSlug: TWorkspaceSlug, hasCurrentWorkspace: boolean): string | null => {
  if (!workspaceSlug || !hasCurrentWorkspace) return null;
  return workspaceSlug.toString();
};

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

type TWorkspaceNotFoundViewProps = {
  allWorkspaces: IWorkspace[] | undefined;
  currentUserEmail: string | undefined;
  isMobile: boolean;
  onSignOut: () => Promise<void>;
};

const WorkspaceNotFoundView = (props: TWorkspaceNotFoundViewProps) => {
  const { allWorkspaces, currentUserEmail, isMobile, onSignOut } = props;
  const { toggleProfileSettingsModal } = useCommandPalette();

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
                onClick={() => toggleProfileSettingsModal({ activeTab: "general", isOpen: true })}
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
  const pathname = usePathname() || "";
  const rootStore = useContext(StoreContext);
  // store hooks
  const { signOut, data: currentUser } = useUser();
  const { workspaces } = useWorkspace();
  const { isMobile } = usePlatformOS();
  const { loader, workspaceInfoBySlug } = useUserPermissions();
  // derived values
  const slug = getSlugString(workspaceSlug);
  const allWorkspaces = getAllWorkspaces(workspaces);
  const currentWorkspace = getCurrentWorkspace(allWorkspaces, workspaceSlug);
  const currentWorkspaceInfo = getCurrentWorkspaceInfo(workspaceSlug, workspaceInfoBySlug);
  const fetchSlug = getFetchSlug(workspaceSlug, Boolean(currentWorkspace));
  const isProjectsListRoute = Boolean(
    fetchSlug && (pathname === `/${fetchSlug}/projects` || pathname === `/${fetchSlug}/projects/`)
  );

  // Pre-hydrate from user-scoped localStorage cache for instant paint before network returns
  const prewarmedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!rootStore || !currentUser?.id || !slug) return;
    const cacheKey = `${currentUser.id}:${slug}`;
    if (prewarmedRef.current === cacheKey) return;
    prewarmedRef.current = cacheKey;
    const cached = readWorkspaceBootstrapCache(currentUser.id, slug);
    if (cached) {
      hydrateWorkspaceBootstrap(rootStore, slug, cached, false);
    }
  }, [rootStore, currentUser?.id, slug]);

  // Preload current route's empty-state illustration immediately and warm core navigation SVGs during idle time
  useEffect(() => {
    if (pathname.includes("/cycles") || pathname.includes("/active-cycles")) {
      preloadDetailedAsset("cycle");
      preloadDetailedAsset("archived-cycle");
    } else if (pathname.includes("/modules")) {
      preloadDetailedAsset("module");
    } else if (pathname.includes("/views") || pathname.includes("/workspace-views")) {
      preloadDetailedAsset("view");
    } else if (pathname.includes("/drafts")) {
      preloadDetailedAsset("draft");
    } else if (pathname.includes("/issues")) {
      preloadDetailedAsset("work-item");
    }
  }, [pathname]);

  useEffect(() => {
    if (hasPreloadedCoreEmptyStates || typeof window === "undefined") return;
    const warm = () => {
      hasPreloadedCoreEmptyStates = true;
      for (const key of CORE_EMPTY_STATE_ASSETS) preloadDetailedAsset(key);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, 800);
    return () => window.clearTimeout(timer);
  }, []);

  // Single aggregated workspace bootstrap (stable key avoids re-running all 9 endpoints on Home <-> Projects navigation)
  const { isLoading: isWorkspaceBootstrapLoading } = useSWR(
    fetchSlug ? `WORKSPACE_BOOTSTRAP_${fetchSlug}` : null,
    async () => {
      if (!fetchSlug) return null;
      const data = await bootstrapService.getWorkspaceBootstrap(fetchSlug, isProjectsListRoute);
      if (rootStore) {
        hydrateWorkspaceBootstrap(rootStore, fetchSlug, data, true);
      }
      writeWorkspaceBootstrapCache(currentUser?.id, fetchSlug, data);
      return data;
    },
    SWR_OPTIONS
  );

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
  if (
    isParentLoading ||
    allWorkspaces === undefined ||
    loader ||
    (Boolean(fetchSlug) && isWorkspaceBootstrapLoading && !currentWorkspaceInfo)
  ) {
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
