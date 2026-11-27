/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  ICycle,
  IEstimate,
  IFavorite,
  IInstanceInfo,
  IIssueLabel,
  IModule,
  IProject,
  IProjectMember,
  IProjectUserPropertiesResponse,
  IProjectView,
  IState,
  IUser,
  IUserProjectsRole,
  IUserSettings,
  IWorkspace,
  IWorkspaceMember,
  IWorkspaceMemberMe,
  IWorkspaceSidebarNavigation,
  IWorkspaceUserPropertiesResponse,
  IWorkspaceView,
  TPartialProject,
  TProjectMembership,
  TUserProfile,
} from "@plane/types";
import { APIService } from "@/services/api.service";

export interface IAppBootstrapResponse {
  authenticated: boolean;
  instance: IInstanceInfo | null;
  user: IUser | null;
  profile: TUserProfile | null;
  settings: IUserSettings | null;
  workspaces: IWorkspace[] | null;
  instance_admin: { is_instance_admin: boolean } | null;
}

export interface IWorkspaceBootstrapResponse {
  workspace_member_me: IWorkspaceMemberMe | null;
  project_roles: IUserProjectsRole | null;
  projects_mode: "partial" | "full";
  projects: (IProject | TPartialProject)[] | null;
  members: IWorkspaceMember[] | null;
  favorites: IFavorite[] | null;
  states: IState[] | null;
  sidebar_preferences: IWorkspaceSidebarNavigation | null;
  user_properties: IWorkspaceUserPropertiesResponse | null;
}

export interface IWorkspaceViewBootstrapResponse {
  views: IWorkspaceView[] | null;
  modules: IModule[] | null;
  cycles: ICycle[] | null;
  labels: IIssueLabel[] | null;
  estimates: IEstimate[] | null;
}

export interface IProjectBootstrapResponse {
  project: IProject | null;
  project_member_me: TProjectMembership | null;
  states: IState[] | null;
  labels: IIssueLabel[] | null;
  members: IProjectMember[] | null;
  user_properties: IProjectUserPropertiesResponse | null;
  cycles: ICycle[] | null;
  modules: IModule[] | null;
  views: IProjectView[] | null;
  estimates: IEstimate[] | null;
}

export class BootstrapService extends APIService {
  private inflightApp: Promise<IAppBootstrapResponse> | null = null;
  private inflightWorkspace = new Map<string, Promise<IWorkspaceBootstrapResponse>>();
  private inflightWorkspaceView = new Map<string, Promise<IWorkspaceViewBootstrapResponse>>();
  private inflightProject = new Map<string, Promise<IProjectBootstrapResponse>>();

  constructor() {
    super(API_BASE_URL);
  }

  getAppBootstrap = async (): Promise<IAppBootstrapResponse> => {
    if (this.inflightApp) return this.inflightApp;
    const req = this.get("/api/bootstrap/")
      .then((res) => res.data as IAppBootstrapResponse)
      .finally(() => {
        this.inflightApp = null;
      });
    this.inflightApp = req;
    return req;
  };

  getWorkspaceBootstrap = async (
    workspaceSlug: string,
    fullProjects: boolean = false
  ): Promise<IWorkspaceBootstrapResponse> => {
    const key = `${workspaceSlug}:${fullProjects ? "full" : "partial"}`;
    const existing = this.inflightWorkspace.get(key);
    if (existing) return existing;
    const query = fullProjects ? "?projects=full" : "";
    const req = this.get(`/api/workspaces/${workspaceSlug}/bootstrap/${query}`)
      .then((res) => res.data as IWorkspaceBootstrapResponse)
      .finally(() => {
        this.inflightWorkspace.delete(key);
      });
    this.inflightWorkspace.set(key, req);
    return req;
  };

  getWorkspaceViewBootstrap = async (workspaceSlug: string): Promise<IWorkspaceViewBootstrapResponse> => {
    const existing = this.inflightWorkspaceView.get(workspaceSlug);
    if (existing) return existing;
    const req = this.get(`/api/workspaces/${workspaceSlug}/view-bootstrap/`)
      .then((res) => res.data as IWorkspaceViewBootstrapResponse)
      .finally(() => {
        this.inflightWorkspaceView.delete(workspaceSlug);
      });
    this.inflightWorkspaceView.set(workspaceSlug, req);
    return req;
  };

  getProjectBootstrap = async (
    workspaceSlug: string,
    projectId: string,
    includes: string[]
  ): Promise<IProjectBootstrapResponse> => {
    const sorted = [...new Set(includes)].toSorted().join(",");
    const key = `${workspaceSlug}:${projectId}:${sorted}`;
    const existing = this.inflightProject.get(key);
    if (existing) return existing;
    const query = sorted ? `?include=${encodeURIComponent(sorted)}` : "";
    const req = this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/bootstrap/${query}`)
      .then((res) => res.data as IProjectBootstrapResponse)
      .finally(() => {
        this.inflightProject.delete(key);
      });
    this.inflightProject.set(key, req);
    return req;
  };
}

export const bootstrapService = new BootstrapService();
