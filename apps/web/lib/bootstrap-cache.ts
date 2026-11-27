/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, update } from "lodash-es";
import { runInAction } from "mobx";
import { mutate } from "swr";
import {
  PROJECT_ALL_CYCLES,
  PROJECT_DETAILS,
  PROJECT_ESTIMATES,
  PROJECT_LABELS,
  PROJECT_MEMBERS,
  PROJECT_MEMBER_PREFERENCES,
  PROJECT_ME_INFORMATION,
  PROJECT_MODULES,
  PROJECT_STATES,
  PROJECT_VIEWS,
  WORKSPACE_CYCLES,
  WORKSPACE_ESTIMATES,
  WORKSPACE_FAVORITE,
  WORKSPACE_LABELS,
  WORKSPACE_MEMBERS,
  WORKSPACE_MEMBER_ME_INFORMATION,
  WORKSPACE_MODULES,
  WORKSPACE_PARTIAL_PROJECTS,
  WORKSPACE_PROJECTS_ROLES_INFORMATION,
  WORKSPACE_PROJECT_NAVIGATION_PREFERENCES,
  WORKSPACE_SIDEBAR_PREFERENCES,
  WORKSPACE_STATES,
} from "@plane/constants";
import { detectBrowserLanguage, FALLBACK_LANGUAGE, setLanguage } from "@plane/i18n";
import type { TLanguage } from "@plane/i18n";
import type { TEstimateSystemKeys, TProject } from "@plane/types";
import type {
  IAppBootstrapResponse,
  IProjectBootstrapResponse,
  IWorkspaceBootstrapResponse,
  IWorkspaceViewBootstrapResponse,
} from "@/services/bootstrap.service";
import { Estimate } from "@/store/estimates/estimate";
import type { CoreRootStore } from "@/store/root.store";

const CACHE_PREFIX = "plane_ws_bootstrap_v1:";
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedWorkspaceBootstrap = {
  ts: number;
  data: IWorkspaceBootstrapResponse;
};

const getCacheKey = (userId: string, workspaceSlug: string) => `${CACHE_PREFIX}${userId}:${workspaceSlug}`;

export function readWorkspaceBootstrapCache(
  userId: string | undefined,
  workspaceSlug: string | undefined,
  now: number = Date.now()
): IWorkspaceBootstrapResponse | null {
  if (!userId || !workspaceSlug || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getCacheKey(userId, workspaceSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWorkspaceBootstrap;
    if (!parsed || typeof parsed.ts !== "number" || !parsed.data) return null;
    if (now - parsed.ts > CACHE_TTL_MS) {
      window.localStorage.removeItem(getCacheKey(userId, workspaceSlug));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeWorkspaceBootstrapCache(
  userId: string | undefined,
  workspaceSlug: string | undefined,
  data: IWorkspaceBootstrapResponse,
  now: number = Date.now()
): void {
  if (!userId || !workspaceSlug || typeof window === "undefined") return;
  try {
    const payload: CachedWorkspaceBootstrap = { ts: now, data };
    window.localStorage.setItem(getCacheKey(userId, workspaceSlug), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private-mode errors gracefully
  }
}

export function clearAllBootstrapCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) keysToDelete.push(key);
    }
    keysToDelete.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage errors
  }
}

export function hydrateAppBootstrap(store: CoreRootStore, data: IAppBootstrapResponse): void {
  runInAction(() => {
    if (data.instance) {
      store.instance.isLoading = false;
      store.instance.error = undefined;
      store.instance.instance = data.instance.instance;
      store.instance.config = data.instance.config;
    }

    if (data.authenticated && data.user?.id) {
      store.user.data = data.user;
      store.user.isAuthenticated = true;
      store.user.isLoading = false;
      store.user.error = undefined;

      if (data.profile) {
        store.user.userProfile.isLoading = false;
        store.user.userProfile.error = undefined;
        store.user.userProfile.data = data.profile;
        const browserLanguage = detectBrowserLanguage();
        if (
          !data.profile.is_onboarded &&
          data.profile.language === FALLBACK_LANGUAGE &&
          browserLanguage !== FALLBACK_LANGUAGE
        ) {
          void setLanguage(browserLanguage);
        } else if (data.profile.language) {
          void setLanguage(data.profile.language as TLanguage);
        }
      }

      if (data.settings) {
        store.user.userSettings.isLoading = false;
        store.user.userSettings.error = undefined;
        store.user.userSettings.data = data.settings;
      }

      if (Array.isArray(data.workspaces)) {
        data.workspaces.forEach((workspace) => {
          set(store.workspaceRoot.workspaces, [workspace.id], workspace);
        });
        store.workspaceRoot.loader = false;
      }
    } else if (!data.authenticated) {
      store.user.isAuthenticated = false;
      store.user.isLoading = false;
    }
  });

  if (data.instance) {
    void mutate("INSTANCE_INFORMATION", data.instance, false);
  }
  if (data.authenticated && data.user?.id) {
    void mutate("USER_INFORMATION", data.user, false);
  }
  if (data.instance_admin !== null && data.instance_admin !== undefined) {
    void mutate("CURRENT_USER_INSTANCE_ADMIN_STATUS", data.instance_admin, false);
  }
}

export function hydrateWorkspaceBootstrap(
  store: CoreRootStore,
  workspaceSlug: string,
  data: IWorkspaceBootstrapResponse,
  primeSwr: boolean = true
): void {
  runInAction(() => {
    if (data.workspace_member_me) {
      set(store.user.permission.workspaceUserInfo, [workspaceSlug], data.workspace_member_me);
      store.user.permission.loader = false;
    }

    if (data.project_roles) {
      set(store.user.permission.workspaceProjectsPermissions, [workspaceSlug], data.project_roles);
    }

    if (Array.isArray(data.projects)) {
      data.projects.forEach((project) => {
        update(store.projectRoot.project.projectMap, [project.id], (p) => ({ ...p, ...project }) as TProject);
      });
      store.projectRoot.project.loader = "loaded";
      if (data.projects_mode === "full") {
        store.projectRoot.project.fetchStatus = "complete";
      } else if (!store.projectRoot.project.fetchStatus) {
        store.projectRoot.project.fetchStatus = "partial";
      }
    }

    if (Array.isArray(data.members)) {
      data.members.forEach((member) => {
        set(store.memberRoot.memberMap, member.member.id, { ...member.member, joining_date: member.created_at });
        set(store.memberRoot.workspace.workspaceMemberMap, [workspaceSlug, member.member.id], {
          id: member.id,
          member: member.member.id,
          role: member.role,
          is_active: member.is_active,
        });
      });
    }

    if (Array.isArray(data.favorites)) {
      const existingIds = new Set(store.favorite.favoriteIds);
      data.favorites.forEach((favorite) => {
        set(store.favorite.favoriteMap, [favorite.id], favorite);
        existingIds.add(favorite.id);
        if (favorite.entity_identifier) {
          set(store.favorite.entityMap, [favorite.entity_identifier], favorite);
        }
      });
      store.favorite.favoriteIds = [...existingIds];
    }

    if (Array.isArray(data.states)) {
      data.states.forEach((state) => {
        set(store.state.stateMap, [state.id], state);
      });
      set(store.state.fetchedMap, workspaceSlug, true);
    }

    if (data.sidebar_preferences) {
      store.workspaceRoot.navigationPreferencesMap[workspaceSlug] = data.sidebar_preferences;
    }

    if (data.user_properties) {
      store.workspaceRoot.projectNavigationPreferencesMap[workspaceSlug] = data.user_properties;
    }
  });

  if (!primeSwr) return;

  if (data.workspace_member_me) {
    void mutate(WORKSPACE_MEMBER_ME_INFORMATION(workspaceSlug), data.workspace_member_me, false);
  }
  if (data.project_roles) {
    void mutate(WORKSPACE_PROJECTS_ROLES_INFORMATION(workspaceSlug), data.project_roles, false);
  }
  if (Array.isArray(data.projects)) {
    void mutate(WORKSPACE_PARTIAL_PROJECTS(workspaceSlug), data.projects, false);
    if (data.projects_mode === "full") {
      void mutate(`WORKSPACE_PROJECTS_${workspaceSlug}`, data.projects, false);
    }
  }
  if (Array.isArray(data.members)) {
    void mutate(WORKSPACE_MEMBERS(workspaceSlug), data.members, false);
  }
  if (Array.isArray(data.favorites)) {
    void mutate(WORKSPACE_FAVORITE(workspaceSlug), data.favorites, false);
  }
  if (Array.isArray(data.states)) {
    void mutate(WORKSPACE_STATES(workspaceSlug), data.states, false);
  }
  if (data.sidebar_preferences) {
    void mutate(WORKSPACE_SIDEBAR_PREFERENCES(workspaceSlug), data.sidebar_preferences, false);
  }
  if (data.user_properties) {
    void mutate(WORKSPACE_PROJECT_NAVIGATION_PREFERENCES(workspaceSlug), data.user_properties, false);
  }
}

export function hydrateWorkspaceViewBootstrap(
  store: CoreRootStore,
  workspaceSlug: string,
  data: IWorkspaceViewBootstrapResponse
): void {
  runInAction(() => {
    if (Array.isArray(data.views)) {
      data.views.forEach((view) => {
        set(store.globalView.globalViewMap, view.id, view);
      });
    }

    if (Array.isArray(data.modules)) {
      const projectIds = new Set<string>();
      data.modules.forEach((mod) => {
        set(store.module.moduleMap, [mod.id], { ...store.module.moduleMap[mod.id], ...mod });
        if (mod.project_id) projectIds.add(mod.project_id);
      });
      projectIds.forEach((projectId) => {
        set(store.module.fetchedMap, projectId, true);
      });
    }

    if (Array.isArray(data.cycles)) {
      data.cycles.forEach((cycle) => {
        set(store.cycle.cycleMap, [cycle.id], { ...store.cycle.cycleMap[cycle.id], ...cycle });
        if (cycle.project_id) set(store.cycle.fetchedMap, cycle.project_id, true);
      });
    }

    if (Array.isArray(data.labels)) {
      data.labels.forEach((label) => {
        set(store.label.labelMap, [label.id], label);
      });
      set(store.label.fetchedMap, workspaceSlug, true);
    }

    if (Array.isArray(data.estimates)) {
      data.estimates.forEach((estimate) => {
        if (estimate.id) {
          set(
            store.projectEstimate.estimates,
            [estimate.id],
            new Estimate(store, { ...estimate, type: estimate.type?.toLowerCase() as TEstimateSystemKeys })
          );
        }
      });
      store.projectEstimate.loader = undefined;
    }
  });

  if (Array.isArray(data.views)) void mutate(`WORKSPACE_GLOBAL_VIEWS_${workspaceSlug}`, data.views, false);
  if (Array.isArray(data.modules)) void mutate(WORKSPACE_MODULES(workspaceSlug), data.modules, false);
  if (Array.isArray(data.cycles)) void mutate(WORKSPACE_CYCLES(workspaceSlug), data.cycles, false);
  if (Array.isArray(data.labels)) void mutate(WORKSPACE_LABELS(workspaceSlug), data.labels, false);
  if (Array.isArray(data.estimates)) void mutate(WORKSPACE_ESTIMATES(workspaceSlug), data.estimates, false);
}

export function hydrateProjectBootstrap(
  store: CoreRootStore,
  workspaceSlug: string,
  projectId: string,
  data: IProjectBootstrapResponse
): void {
  const role = data.project_member_me?.role;
  runInAction(() => {
    if (data.project) {
      update(store.projectRoot.project.projectMap, [projectId], (p) => ({ ...p, ...data.project }) as TProject);
    }

    if (data.project_member_me) {
      set(store.user.permission.projectUserInfo, [workspaceSlug, projectId], data.project_member_me);
      set(store.user.permission.workspaceProjectsPermissions, [workspaceSlug, projectId], data.project_member_me.role);
    }

    if (Array.isArray(data.states)) {
      data.states.forEach((state) => {
        set(store.state.stateMap, [state.id], state);
      });
      set(store.state.fetchedMap, projectId, true);
    }

    if (Array.isArray(data.labels)) {
      data.labels.forEach((label) => {
        set(store.label.labelMap, [label.id], label);
      });
      set(store.label.fetchedMap, projectId, true);
    }

    if (Array.isArray(data.members)) {
      data.members.forEach((member) => {
        set(store.memberRoot.project.projectMemberMap, [projectId, member.member], member);
      });
      set(store.memberRoot.project.projectMemberFetchStatusMap, [projectId], true);
    }

    if (data.user_properties) {
      set(store.memberRoot.project.projectUserPropertiesMap, [projectId], data.user_properties);
    }

    if (Array.isArray(data.cycles)) {
      data.cycles.forEach((cycle) => {
        set(store.cycle.cycleMap, [cycle.id], { ...store.cycle.cycleMap[cycle.id], ...cycle });
      });
      set(store.cycle.fetchedMap, projectId, true);
    }

    if (Array.isArray(data.modules)) {
      data.modules.forEach((mod) => {
        set(store.module.moduleMap, [mod.id], { ...store.module.moduleMap[mod.id], ...mod });
      });
      set(store.module.fetchedMap, projectId, true);
    }

    if (Array.isArray(data.views)) {
      data.views.forEach((view) => {
        set(store.projectView.viewMap, [view.id], view);
      });
      set(store.projectView.fetchedMap, projectId, true);
      store.projectView.loader = false;
    }

    if (Array.isArray(data.estimates)) {
      data.estimates.forEach((estimate) => {
        if (estimate.id) {
          set(
            store.projectEstimate.estimates,
            [estimate.id],
            new Estimate(store, { ...estimate, type: estimate.type?.toLowerCase() as TEstimateSystemKeys })
          );
        }
      });
      store.projectEstimate.loader = undefined;
    }
  });

  if (data.project) void mutate(PROJECT_DETAILS(workspaceSlug, projectId), data.project, false);
  if (data.project_member_me)
    void mutate(PROJECT_ME_INFORMATION(workspaceSlug, projectId), data.project_member_me, false);
  if (role !== undefined) {
    if (Array.isArray(data.states)) void mutate(PROJECT_STATES(projectId, role), data.states, false);
    if (Array.isArray(data.labels)) void mutate(PROJECT_LABELS(projectId, role), data.labels, false);
    if (Array.isArray(data.members)) void mutate(PROJECT_MEMBERS(projectId, role), data.members, false);
    if (data.user_properties) void mutate(PROJECT_MEMBER_PREFERENCES(projectId, role), data.user_properties, false);
    if (Array.isArray(data.cycles)) void mutate(PROJECT_ALL_CYCLES(projectId, role), data.cycles, false);
    if (Array.isArray(data.modules)) void mutate(PROJECT_MODULES(projectId, role), data.modules, false);
    if (Array.isArray(data.views)) void mutate(PROJECT_VIEWS(projectId, role), data.views, false);
    if (Array.isArray(data.estimates)) void mutate(PROJECT_ESTIMATES(projectId, role), data.estimates, false);
  }
}
