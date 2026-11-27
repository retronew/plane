/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, PROJECT_INTAKE_STATE } from "@plane/constants";
import { GANTT_TIMELINE_TYPE } from "@plane/types";
// components
import { ProjectAccessRestriction } from "@/components/auth-screens/project/project-access-restriction";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";
import { hydrateProjectBootstrap } from "@/lib/bootstrap-cache";
import { StoreContext } from "@/lib/store-context";
import { bootstrapService } from "@/services/bootstrap.service";

interface IProjectAuthWrapper {
  workspaceSlug: string;
  projectId: string;
  children: ReactNode;
  isLoading?: boolean;
  loadingFallback?: ReactNode;
}

export const ProjectAuthWrapper = observer(function ProjectAuthWrapper(props: IProjectAuthWrapper) {
  const { workspaceSlug, projectId, children, isLoading: isParentLoading = false } = props;
  const rootStore = useContext(StoreContext);
  // states
  const [isJoiningProject, setIsJoiningProject] = useState(false);
  // store hooks
  const { allowPermissions, getProjectRoleByWorkspaceSlugAndProjectId, joinProject } = useUserPermissions();
  const { getProjectById } = useProject();
  const { initGantt } = useTimeLineChart(GANTT_TIMELINE_TYPE.MODULE);
  const { fetchProjectIntakeState } = useProjectState();
  const { data: currentUserData } = useUser();
  // router
  const pathname = usePathname() || "";
  // derived values
  const hasPermissionToCurrentProject = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );
  const currentProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);
  const isWorkspaceAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const projectDetails = getProjectById(projectId);
  const canFetchProjectResources = currentProjectRole !== undefined && hasPermissionToCurrentProject === true;

  // Scope sub-resource preloading by active route so settings/pages/overview/intake don't over-fetch
  const isSettingsRoute = pathname.includes("/settings/projects/");
  const isPagesRoute = !isSettingsRoute && pathname.includes("/pages");
  const isOverviewRoute = !isSettingsRoute && pathname.includes("/overview");
  const isIntakeRoute = !isSettingsRoute && pathname.includes("/intake");
  const isBrowseRoute = pathname.includes("/browse/");
  const isCyclesRoute = !isSettingsRoute && pathname.includes("/cycles");
  const isModulesRoute = !isSettingsRoute && pathname.includes("/modules");
  const isViewsRoute = !isSettingsRoute && pathname.includes("/views");

  const needUserProperties = !isSettingsRoute && !isPagesRoute && !isOverviewRoute && !isIntakeRoute && !isBrowseRoute;
  const needLabels =
    (!isSettingsRoute && !isOverviewRoute) || pathname.endsWith("/labels") || pathname.endsWith("/labels/");
  const needMembers = !isSettingsRoute || pathname.endsWith("/members") || pathname.endsWith("/members/");
  const needStates =
    (!isSettingsRoute && !isPagesRoute) ||
    pathname.includes("/states") ||
    pathname.includes("/workflows") ||
    pathname.includes("/automations");
  const needIntakeState = isIntakeRoute;
  const needEstimates = (!isSettingsRoute && !isPagesRoute && !isOverviewRoute) || pathname.includes("/estimates");
  const needCycles = !isSettingsRoute && !isPagesRoute && !isOverviewRoute && !isIntakeRoute && !isModulesRoute;
  const needModules = !isSettingsRoute && !isPagesRoute && !isOverviewRoute && !isIntakeRoute && !isCyclesRoute;
  const needViews = isViewsRoute;
  const needGantt = !isSettingsRoute && !isPagesRoute && !isOverviewRoute && !isIntakeRoute && !isBrowseRoute;

  // Initialize module timeline chart only on work-item / cycle / module / view routes
  useEffect(() => {
    if (needGantt) initGantt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needGantt]);

  // Build route-scoped include list filtered to resources not yet hydrated in MobX so
  // switching tabs inside the same project (Issues <-> Browse <-> Cycles <-> Modules) never re-runs full bootstrap.
  const hasCoreHydrated = Boolean(
    rootStore?.projectRoot.project.projectMap[projectId] &&
    rootStore?.user.permission.projectUserInfo[workspaceSlug]?.[projectId]
  );
  const bootstrapIncludes = useMemo(() => {
    const list: string[] = [];
    if (needStates && !rootStore?.state.fetchedMap[projectId]) list.push("states");
    if (needLabels && !rootStore?.label.fetchedMap[projectId]) list.push("labels");
    if (needMembers && !rootStore?.memberRoot.project.projectMemberFetchStatusMap[projectId]) list.push("members");
    if (
      needUserProperties &&
      currentUserData?.id &&
      !rootStore?.memberRoot.project.projectUserPropertiesMap[projectId]
    ) {
      list.push("user_properties");
    }
    if (needEstimates && (projectDetails ? Boolean(projectDetails.estimate) : true) && !hasCoreHydrated) {
      list.push("estimates");
    }
    if (
      needCycles &&
      (projectDetails ? Boolean(projectDetails.cycle_view) : true) &&
      !rootStore?.cycle.fetchedMap[projectId]
    ) {
      list.push("cycles");
    }
    if (
      needModules &&
      (projectDetails ? Boolean(projectDetails.module_view) : true) &&
      !rootStore?.module.fetchedMap[projectId]
    ) {
      list.push("modules");
    }
    if (
      needViews &&
      (projectDetails ? Boolean(projectDetails.issue_views_view) : true) &&
      !rootStore?.projectView.fetchedMap[projectId]
    ) {
      list.push("views");
    }
    return list;
  }, [
    needStates,
    needLabels,
    needMembers,
    needUserProperties,
    currentUserData?.id,
    needEstimates,
    needCycles,
    needModules,
    needViews,
    projectDetails,
    projectId,
    hasCoreHydrated,
    rootStore,
  ]);
  const includeKey = bootstrapIncludes.join(",");
  const shouldFetchProjectBootstrap = Boolean(
    workspaceSlug && projectId && (!hasCoreHydrated || bootstrapIncludes.length > 0)
  );

  // Single aggregated project bootstrap (merges project details, role, states, labels, members, user-properties, cycles/modules/views/estimates)
  const { isLoading: isProjectDetailsLoading, error: projectDetailsError } = useSWR(
    shouldFetchProjectBootstrap ? `PROJECT_BOOTSTRAP_${workspaceSlug}_${projectId}_${includeKey}` : null,
    async () => {
      const data = await bootstrapService.getProjectBootstrap(workspaceSlug, projectId, bootstrapIncludes);
      if (rootStore) {
        hydrateProjectBootstrap(rootStore, workspaceSlug, projectId, data);
      }
      return data;
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  // fetching project intake state only on intake routes
  useSWR(
    canFetchProjectResources && needIntakeState && Boolean(projectDetails?.inbox_view)
      ? PROJECT_INTAKE_STATE(projectId, currentProjectRole)
      : null,
    () => fetchProjectIntakeState(workspaceSlug, projectId),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  );

  // handle join project
  const handleJoinProject = () => {
    setIsJoiningProject(true);
    joinProject(workspaceSlug, projectId).finally(() => setIsJoiningProject(false));
  };

  const hasCachedProjectAccess = Boolean(getProjectById(projectId)) && currentProjectRole !== undefined;
  const isProjectLoading =
    (isParentLoading || (isProjectDetailsLoading && !hasCachedProjectAccess)) && !projectDetailsError;

  if (isProjectLoading) return <>{props.loadingFallback}</>;

  if (!isProjectLoading && hasPermissionToCurrentProject === false) {
    return (
      <ProjectAccessRestriction
        errorStatusCode={projectDetailsError?.status}
        isWorkspaceAdmin={isWorkspaceAdmin}
        handleJoinProject={handleJoinProject}
        isJoinButtonDisabled={isJoiningProject}
      />
    );
  }

  return <>{children}</>;
});
