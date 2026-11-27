/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { GANTT_TIMELINE_TYPE } from "@plane/types";
// components
import { ProjectAccessRestriction } from "@/components/auth-screens/project/project-access-restriction";
import {
  PROJECT_DETAILS,
  PROJECT_ME_INFORMATION,
  PROJECT_LABELS,
  PROJECT_MEMBERS,
  PROJECT_MEMBER_PREFERENCES,
  PROJECT_STATES,
  PROJECT_ESTIMATES,
  PROJECT_ALL_CYCLES,
  PROJECT_MODULES,
  PROJECT_VIEWS,
  PROJECT_INTAKE_STATE,
} from "@plane/constants";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useCycle } from "@/hooks/store/use-cycle";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useProjectView } from "@/hooks/store/use-project-view";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";

interface IProjectAuthWrapper {
  workspaceSlug: string;
  projectId: string;
  children: ReactNode;
  isLoading?: boolean;
  loadingFallback?: ReactNode;
}

export const ProjectAuthWrapper = observer(function ProjectAuthWrapper(props: IProjectAuthWrapper) {
  const { workspaceSlug, projectId, children, isLoading: isParentLoading = false } = props;
  // states
  const [isJoiningProject, setIsJoiningProject] = useState(false);
  // store hooks
  const { fetchUserProjectInfo, allowPermissions, getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const { fetchProjectDetails, getProjectById } = useProject();
  const { joinProject } = useUserPermissions();
  const { fetchAllCycles } = useCycle();
  const { fetchModules } = useModule();
  const { initGantt } = useTimeLineChart(GANTT_TIMELINE_TYPE.MODULE);
  const { fetchViews } = useProjectView();
  const {
    project: { fetchProjectMembers, fetchProjectUserProperties },
  } = useMember();
  const { fetchProjectStates, fetchProjectIntakeState } = useProjectState();
  const { data: currentUserData } = useUser();
  const { fetchProjectLabels } = useLabel();
  const { getProjectEstimates } = useProjectEstimates();
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

  // fetching project details
  const { isLoading: isProjectDetailsLoading, error: projectDetailsError } = useSWR(
    PROJECT_DETAILS(workspaceSlug, projectId),
    () => fetchProjectDetails(workspaceSlug, projectId),
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  // fetching user project member information only when role is not yet known from workspace roles
  useSWR(
    currentProjectRole === undefined ? PROJECT_ME_INFORMATION(workspaceSlug, projectId) : null,
    () => fetchUserProjectInfo(workspaceSlug, projectId),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  );
  // fetching project member preferences
  useSWR(
    canFetchProjectResources && needUserProperties && currentUserData?.id
      ? PROJECT_MEMBER_PREFERENCES(projectId, currentProjectRole)
      : null,
    () => fetchProjectUserProperties(workspaceSlug, projectId),
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  // fetching project labels
  useSWR(
    canFetchProjectResources && needLabels ? PROJECT_LABELS(projectId, currentProjectRole) : null,
    () => fetchProjectLabels(workspaceSlug, projectId),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  );
  // fetching project members
  useSWR(
    canFetchProjectResources && needMembers ? PROJECT_MEMBERS(projectId, currentProjectRole) : null,
    () => fetchProjectMembers(workspaceSlug, projectId),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  );
  // fetching project states
  useSWR(
    canFetchProjectResources && needStates ? PROJECT_STATES(projectId, currentProjectRole) : null,
    () => fetchProjectStates(workspaceSlug, projectId),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  );
  // fetching project intake state
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
  // fetching project estimates
  useSWR(
    canFetchProjectResources && needEstimates && Boolean(projectDetails?.estimate)
      ? PROJECT_ESTIMATES(projectId, currentProjectRole)
      : null,
    () => getProjectEstimates(workspaceSlug, projectId),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  );
  // fetching project cycles
  useSWR(
    canFetchProjectResources && needCycles && Boolean(projectDetails?.cycle_view)
      ? PROJECT_ALL_CYCLES(projectId, currentProjectRole)
      : null,
    () => fetchAllCycles(workspaceSlug, projectId),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  );
  // fetching project modules
  useSWR(
    canFetchProjectResources && needModules && Boolean(projectDetails?.module_view)
      ? PROJECT_MODULES(projectId, currentProjectRole)
      : null,
    () => fetchModules(workspaceSlug, projectId),
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  // fetching project views
  useSWR(
    canFetchProjectResources && needViews && Boolean(projectDetails?.issue_views_view)
      ? PROJECT_VIEWS(projectId, currentProjectRole)
      : null,
    () => fetchViews(workspaceSlug, projectId),
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
