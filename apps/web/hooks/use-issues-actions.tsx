/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
// types
import { useParams } from "next/navigation";
import type { TSupportedFilterTypeForUpdate } from "@plane/constants";
import { EDraftIssuePaginationType } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IssuePaginationOptions,
  TIssue,
  TIssuesResponse,
  TLoader,
  TProfileViews,
  TSupportedFilterForUpdate,
} from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { useIssues } from "./store/use-issues";

export interface IssueActions {
  fetchIssues: (
    loadType: TLoader,
    options: IssuePaginationOptions,
    viewId?: string
  ) => Promise<TIssuesResponse | undefined>;
  fetchNextIssues: (groupId?: string, subGroupId?: string) => Promise<TIssuesResponse | undefined>;
  removeIssue: (projectId: string | undefined | null, issueId: string) => Promise<void>;
  createIssue?: (projectId: string | undefined | null, data: Partial<TIssue>) => Promise<TIssue | undefined>;
  quickAddIssue?: (projectId: string | undefined | null, data: TIssue) => Promise<TIssue | undefined>;
  updateIssue?: (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => Promise<void>;
  removeIssueFromView?: (projectId: string | undefined | null, issueId: string) => Promise<void>;
  archiveIssue?: (projectId: string | undefined | null, issueId: string) => Promise<void>;
  restoreIssue?: (projectId: string | undefined | null, issueId: string) => Promise<void>;
  updateFilters: (
    projectId: string,
    filterType: TSupportedFilterTypeForUpdate,
    filters: TSupportedFilterForUpdate
  ) => Promise<void>;
}

export const useIssuesActions = (storeType: EIssuesStoreType): IssueActions => {
  const projectIssueActions = useProjectIssueActions();
  const cycleIssueActions = useCycleIssueActions();
  const moduleIssueActions = useModuleIssueActions();
  const projectViewIssueActions = useProjectViewIssueActions();
  const globalIssueActions = useGlobalIssueActions();
  const profileIssueActions = useProfileIssueActions();
  const archivedIssueActions = useArchivedIssueActions();
  const workspaceDraftIssueActions = useWorkspaceDraftIssueActions();

  switch (storeType) {
    case EIssuesStoreType.PROJECT_VIEW:
      return projectViewIssueActions;
    case EIssuesStoreType.PROFILE:
      return profileIssueActions;
    case EIssuesStoreType.ARCHIVED:
      return archivedIssueActions;
    case EIssuesStoreType.CYCLE:
      return cycleIssueActions;
    case EIssuesStoreType.MODULE:
      return moduleIssueActions;
    case EIssuesStoreType.GLOBAL:
      return globalIssueActions;
    case EIssuesStoreType.WORKSPACE_DRAFT:
      //@ts-expect-error type mismatch
      return workspaceDraftIssueActions;
    case EIssuesStoreType.PROJECT:
    default:
      return projectIssueActions;
  }
};

const useProjectIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const routeProjectId = routerProjectId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT);
  const { updateFilters: filterUpdateFilters } = issuesFilter;
  const {
    fetchIssues: storeFetchIssues,
    fetchNextIssues: storeFetchNextIssues,
    createIssue: storeCreateIssue,
    quickAddIssue: storeQuickAddIssue,
    updateIssue: storeUpdateIssue,
    removeIssue: storeRemoveIssue,
    archiveIssue: storeArchiveIssue,
  } = issues;

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions) => {
      if (!workspaceSlug || !routeProjectId) return;
      return storeFetchIssues(workspaceSlug.toString(), routeProjectId.toString(), loadType, options);
    },
    [storeFetchIssues, workspaceSlug, routeProjectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !routeProjectId) return;
      return storeFetchNextIssues(workspaceSlug.toString(), routeProjectId.toString(), groupId, subGroupId);
    },
    [storeFetchNextIssues, workspaceSlug, routeProjectId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeCreateIssue(workspaceSlug, projectId, data);
    },
    [storeCreateIssue, workspaceSlug]
  );
  const quickAddIssue = useCallback(
    async (projectId: string | undefined | null, data: TIssue) => {
      if (!workspaceSlug || !projectId) return;
      return await storeQuickAddIssue(workspaceSlug, projectId, data);
    },
    [storeQuickAddIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeUpdateIssue(workspaceSlug, projectId, issueId, data);
    },
    [storeUpdateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRemoveIssue(workspaceSlug, projectId, issueId);
    },
    [storeRemoveIssue, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeArchiveIssue(workspaceSlug, projectId, issueId);
    },
    [storeArchiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!workspaceSlug) return;
      return await filterUpdateFilters(workspaceSlug, projectId, filterType, filters);
    },
    [filterUpdateFilters, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      archiveIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, quickAddIssue, updateIssue, removeIssue, archiveIssue, updateFilters]
  );
};

const useCycleIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId, cycleId: routerCycleId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const routeProjectId = routerProjectId?.toString();
  const routeCycleId = routerCycleId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.CYCLE);
  const { updateFilters: filterUpdateFilters } = issuesFilter;
  const {
    fetchIssues: storeFetchIssues,
    fetchNextIssues: storeFetchNextIssues,
    createIssue: storeCreateIssue,
    quickAddIssue: storeQuickAddIssue,
    updateIssue: storeUpdateIssue,
    removeIssue: storeRemoveIssue,
    removeIssueFromCycle: storeRemoveIssueFromCycle,
    archiveIssue: storeArchiveIssue,
  } = issues;

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions, cycleId?: string) => {
      if (!workspaceSlug || !routeProjectId || !cycleId) return;
      return storeFetchIssues(
        workspaceSlug.toString(),
        routeProjectId.toString(),
        loadType,
        options,
        cycleId.toString()
      );
    },
    [storeFetchIssues, workspaceSlug, routeProjectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !routeProjectId || !routeCycleId) return;
      return storeFetchNextIssues(
        workspaceSlug.toString(),
        routeProjectId.toString(),
        routeCycleId.toString(),
        groupId,
        subGroupId
      );
    },
    [storeFetchNextIssues, workspaceSlug, routeProjectId, routeCycleId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!routeCycleId || !workspaceSlug || !projectId) return;
      return await storeCreateIssue(workspaceSlug, projectId, data, routeCycleId);
    },
    [storeCreateIssue, routeCycleId, workspaceSlug]
  );
  const quickAddIssue = useCallback(
    async (projectId: string | undefined | null, data: TIssue) => {
      if (!routeCycleId || !workspaceSlug || !projectId) return;
      return await storeQuickAddIssue(workspaceSlug, projectId, data, routeCycleId);
    },
    [storeQuickAddIssue, workspaceSlug, routeCycleId]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeUpdateIssue(workspaceSlug, projectId, issueId, data);
    },
    [storeUpdateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRemoveIssue(workspaceSlug, projectId, issueId);
    },
    [storeRemoveIssue, workspaceSlug]
  );
  const removeIssueFromView = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!routeCycleId || !workspaceSlug || !projectId) return;
      return await storeRemoveIssueFromCycle(workspaceSlug, projectId, routeCycleId, issueId);
    },
    [storeRemoveIssueFromCycle, routeCycleId, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeArchiveIssue(workspaceSlug, projectId, issueId);
    },
    [storeArchiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!routeCycleId || !workspaceSlug) return;
      return await filterUpdateFilters(workspaceSlug, projectId, filterType, filters, routeCycleId);
    },
    [filterUpdateFilters, routeCycleId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      removeIssueFromView,
      archiveIssue,
      updateFilters,
    }),
    [
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      removeIssueFromView,
      archiveIssue,
      updateFilters,
    ]
  );
};

const useModuleIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId, moduleId: routerModuleId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const routeProjectId = routerProjectId?.toString();
  const routeModuleId = routerModuleId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.MODULE);
  const { updateFilters: filterUpdateFilters } = issuesFilter;
  const {
    fetchIssues: storeFetchIssues,
    fetchNextIssues: storeFetchNextIssues,
    createIssue: storeCreateIssue,
    quickAddIssue: storeQuickAddIssue,
    updateIssue: storeUpdateIssue,
    removeIssue: storeRemoveIssue,
    removeIssuesFromModule: storeRemoveIssuesFromModule,
    archiveIssue: storeArchiveIssue,
  } = issues;

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions, moduleId?: string) => {
      if (!workspaceSlug || !routeProjectId || !moduleId) return;
      return storeFetchIssues(
        workspaceSlug.toString(),
        routeProjectId.toString(),
        loadType,
        options,
        moduleId.toString()
      );
    },
    [storeFetchIssues, workspaceSlug, routeProjectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !routeProjectId || !routeModuleId) return;
      return storeFetchNextIssues(
        workspaceSlug.toString(),
        routeProjectId.toString(),
        routeModuleId.toString(),
        groupId,
        subGroupId
      );
    },
    [storeFetchNextIssues, workspaceSlug, routeProjectId, routeModuleId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!routeModuleId || !workspaceSlug || !projectId) return;
      return await storeCreateIssue(workspaceSlug, projectId, data, routeModuleId);
    },
    [storeCreateIssue, routeModuleId, workspaceSlug]
  );
  const quickAddIssue = useCallback(
    async (projectId: string | undefined | null, data: TIssue) => {
      if (!routeModuleId || !workspaceSlug || !projectId) return;
      return await storeQuickAddIssue(workspaceSlug, projectId, data, routeModuleId);
    },
    [storeQuickAddIssue, workspaceSlug, routeModuleId]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeUpdateIssue(workspaceSlug, projectId, issueId, data);
    },
    [storeUpdateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRemoveIssue(workspaceSlug, projectId, issueId);
    },
    [storeRemoveIssue, workspaceSlug]
  );
  const removeIssueFromView = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!routeModuleId || !workspaceSlug || !projectId) return;
      return await storeRemoveIssuesFromModule(workspaceSlug, projectId, routeModuleId, [issueId]);
    },
    [storeRemoveIssuesFromModule, routeModuleId, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeArchiveIssue(workspaceSlug, projectId, issueId);
    },
    [storeArchiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!routeModuleId || !workspaceSlug) return;
      return await filterUpdateFilters(workspaceSlug, projectId, filterType, filters, routeModuleId);
    },
    [filterUpdateFilters, routeModuleId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      removeIssueFromView,
      archiveIssue,
      updateFilters,
    }),
    [
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      removeIssueFromView,
      archiveIssue,
      updateFilters,
    ]
  );
};

const useProfileIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, userId: routerUserId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const userId = routerUserId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROFILE);
  const { updateFilters: filterUpdateFilters } = issuesFilter;
  const {
    fetchIssues: storeFetchIssues,
    fetchNextIssues: storeFetchNextIssues,
    createIssue: storeCreateIssue,
    updateIssue: storeUpdateIssue,
    removeIssue: storeRemoveIssue,
    archiveIssue: storeArchiveIssue,
  } = issues;

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions, viewId?: string) => {
      if (!workspaceSlug || !userId || !viewId) return;
      return storeFetchIssues(workspaceSlug.toString(), userId.toString(), loadType, options, viewId as TProfileViews);
    },
    [storeFetchIssues, workspaceSlug, userId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !userId) return;
      return storeFetchNextIssues(workspaceSlug.toString(), userId.toString(), groupId, subGroupId);
    },
    [storeFetchNextIssues, workspaceSlug, userId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeCreateIssue(workspaceSlug, projectId, data);
    },
    [storeCreateIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeUpdateIssue(workspaceSlug, projectId, issueId, data);
    },
    [storeUpdateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRemoveIssue(workspaceSlug, projectId, issueId);
    },
    [storeRemoveIssue, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeArchiveIssue(workspaceSlug, projectId, issueId);
    },
    [storeArchiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!userId || !workspaceSlug) return;
      return await filterUpdateFilters(workspaceSlug, projectId, filterType, filters, userId);
    },
    [filterUpdateFilters, userId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      updateIssue,
      removeIssue,
      archiveIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, updateIssue, removeIssue, archiveIssue, updateFilters]
  );
};

const useProjectViewIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId, viewId: routerViewId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const routeProjectId = routerProjectId?.toString();
  const routeViewId = routerViewId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT_VIEW);
  const { updateFilters: filterUpdateFilters } = issuesFilter;
  const {
    fetchIssues: storeFetchIssues,
    fetchNextIssues: storeFetchNextIssues,
    createIssue: storeCreateIssue,
    quickAddIssue: storeQuickAddIssue,
    updateIssue: storeUpdateIssue,
    removeIssue: storeRemoveIssue,
    archiveIssue: storeArchiveIssue,
  } = issues;

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions, viewId?: string) => {
      if (!workspaceSlug || !routeProjectId || !viewId) return;
      return storeFetchIssues(workspaceSlug.toString(), routeProjectId.toString(), viewId, loadType, options);
    },
    [storeFetchIssues, workspaceSlug, routeProjectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !routeProjectId || !routeViewId) return;
      return storeFetchNextIssues(
        workspaceSlug.toString(),
        routeProjectId.toString(),
        routeViewId,
        groupId,
        subGroupId
      );
    },
    [storeFetchNextIssues, workspaceSlug, routeProjectId, routeViewId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeCreateIssue(workspaceSlug, projectId, data);
    },
    [storeCreateIssue, workspaceSlug]
  );
  const quickAddIssue = useCallback(
    async (projectId: string | undefined | null, data: TIssue) => {
      if (!workspaceSlug || !projectId) return;
      return await storeQuickAddIssue(workspaceSlug, projectId, data);
    },
    [storeQuickAddIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeUpdateIssue(workspaceSlug, projectId, issueId, data);
    },
    [storeUpdateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRemoveIssue(workspaceSlug, projectId, issueId);
    },
    [storeRemoveIssue, workspaceSlug]
  );
  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeArchiveIssue(workspaceSlug, projectId, issueId);
    },
    [storeArchiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!routeViewId || !workspaceSlug) return;
      return await filterUpdateFilters(workspaceSlug, projectId, filterType, filters, routeViewId);
    },
    [filterUpdateFilters, routeViewId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      quickAddIssue,
      updateIssue,
      removeIssue,
      archiveIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, quickAddIssue, updateIssue, removeIssue, archiveIssue, updateFilters]
  );
};

const useArchivedIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const routeProjectId = routerProjectId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.ARCHIVED);
  const { updateFilters: filterUpdateFilters } = issuesFilter;
  const {
    fetchIssues: storeFetchIssues,
    fetchNextIssues: storeFetchNextIssues,
    removeIssue: storeRemoveIssue,
    restoreIssue: storeRestoreIssue,
  } = issues;

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions) => {
      if (!workspaceSlug || !routeProjectId) return;
      return storeFetchIssues(workspaceSlug.toString(), routeProjectId.toString(), loadType, options);
    },
    [storeFetchIssues, workspaceSlug, routeProjectId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !routeProjectId) return;
      return storeFetchNextIssues(workspaceSlug.toString(), routeProjectId.toString(), groupId, subGroupId);
    },
    [storeFetchNextIssues, workspaceSlug, routeProjectId]
  );

  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRemoveIssue(workspaceSlug, projectId, issueId);
    },
    [storeRemoveIssue, workspaceSlug]
  );
  const restoreIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRestoreIssue(workspaceSlug, projectId, issueId);
    },
    [storeRestoreIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!workspaceSlug) return;
      return await filterUpdateFilters(workspaceSlug, projectId, filterType, filters);
    },
    [filterUpdateFilters, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      removeIssue,
      restoreIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, removeIssue, restoreIssue, updateFilters]
  );
};

const useGlobalIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, globalViewId: routerGlobalViewId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const globalViewId = routerGlobalViewId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.GLOBAL);
  const { updateFilters: filterUpdateFilters } = issuesFilter;
  const {
    fetchIssues: storeFetchIssues,
    fetchNextIssues: storeFetchNextIssues,
    createIssue: storeCreateIssue,
    updateIssue: storeUpdateIssue,
    removeIssue: storeRemoveIssue,
    archiveIssue: storeArchiveIssue,
  } = issues;

  const fetchIssues = useCallback(
    async (loadType: TLoader, options: IssuePaginationOptions) => {
      if (!workspaceSlug || !globalViewId) return;
      return storeFetchIssues(workspaceSlug.toString(), globalViewId.toString(), loadType, options);
    },
    [storeFetchIssues, workspaceSlug, globalViewId]
  );
  const fetchNextIssues = useCallback(
    async (groupId?: string, subGroupId?: string) => {
      if (!workspaceSlug || !globalViewId) return;
      return storeFetchNextIssues(workspaceSlug.toString(), globalViewId.toString(), groupId, subGroupId);
    },
    [storeFetchNextIssues, workspaceSlug, globalViewId]
  );

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeCreateIssue(workspaceSlug, projectId, data);
    },
    [storeCreateIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeUpdateIssue(workspaceSlug, projectId, issueId, data);
    },
    [storeUpdateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRemoveIssue(workspaceSlug, projectId, issueId);
    },
    [storeRemoveIssue, workspaceSlug]
  );

  const archiveIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return storeArchiveIssue(workspaceSlug, projectId, issueId);
    },
    [storeArchiveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      if (!globalViewId || !workspaceSlug) return;
      return await filterUpdateFilters(workspaceSlug, projectId, filterType, filters, globalViewId);
    },
    [filterUpdateFilters, globalViewId, workspaceSlug]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      updateIssue,
      removeIssue,
      archiveIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, updateIssue, removeIssue, archiveIssue, updateFilters]
  );
};

const useWorkspaceDraftIssueActions = () => {
  // router
  const { workspaceSlug: routerWorkspaceSlug, globalViewId: routerGlobalViewId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const globalViewId = routerGlobalViewId?.toString();
  // store hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.WORKSPACE_DRAFT);
  const { updateFilters: filterUpdateFilters } = issuesFilter;
  const {
    fetchIssues: storeFetchIssues,
    createIssue: storeCreateIssue,
    updateIssue: storeUpdateIssue,
    removeIssue: storeRemoveIssue,
  } = issues;
  const fetchIssues = useCallback(
    async (loadType: TLoader, _options: IssuePaginationOptions) => {
      if (!workspaceSlug) return;
      return storeFetchIssues(workspaceSlug.toString(), loadType, EDraftIssuePaginationType.INIT);
    },
    [workspaceSlug, storeFetchIssues]
  );

  const fetchNextIssues = useCallback(async () => {
    if (!workspaceSlug) return;
    return storeFetchIssues(workspaceSlug.toString(), "pagination", EDraftIssuePaginationType.NEXT);
  }, [workspaceSlug, storeFetchIssues]);

  const createIssue = useCallback(
    async (projectId: string | undefined | null, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeCreateIssue(workspaceSlug, data);
    },
    [storeCreateIssue, workspaceSlug]
  );
  const updateIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string, data: Partial<TIssue>) => {
      if (!workspaceSlug || !projectId) return;
      return await storeUpdateIssue(workspaceSlug, issueId, data);
    },
    [storeUpdateIssue, workspaceSlug]
  );
  const removeIssue = useCallback(
    async (projectId: string | undefined | null, issueId: string) => {
      if (!workspaceSlug || !projectId) return;
      return await storeRemoveIssue(issueId);
    },
    [storeRemoveIssue, workspaceSlug]
  );

  const updateFilters = useCallback(
    async (projectId: string, filterType: TSupportedFilterTypeForUpdate, filters: TSupportedFilterForUpdate) => {
      filters = filters as IIssueDisplayFilterOptions | IIssueDisplayProperties;
      if (!globalViewId || !workspaceSlug) return;
      return await filterUpdateFilters(workspaceSlug, filterType, filters);
    },
    [globalViewId, workspaceSlug, filterUpdateFilters]
  );

  return useMemo(
    () => ({
      fetchIssues,
      fetchNextIssues,
      createIssue,
      updateIssue,
      removeIssue,
      updateFilters,
    }),
    [fetchIssues, fetchNextIssues, createIssue, updateIssue, removeIssue, updateFilters]
  );
};
