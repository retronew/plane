import { API_BASE_URL } from "@plane/constants";
import type { TLogoProps, TStateIcon } from "@plane/types";
import { APIService } from "@/services/api.service";

export type ProjectCategory = {
  id: string;
  kind: "status" | "label";
  name: string;
  color: string;
  sort_order: number;
  group: string;
  description: string;
  is_default: boolean;
};
export type WorkspaceTemplate = {
  id: string;
  kind: "project" | "work_item" | "page";
  short_description: string;
  is_default_state_template?: boolean;
  project: string | null;
  configuration: TemplateConfiguration;
  name: string;
  title: string;
  description_html: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
};
export type TemplateWorkItemChild = {
  client_id?: string;
  name: string;
  description_html: string;
  type_id?: string | null;
  state_id?: string | null;
  priority?: WorkspaceTemplate["priority"];
  assignee_ids?: string[];
  label_ids?: string[];
};
export type TemplateConfiguration = {
  description?: string;
  network?: 0 | 2;
  project_lead?: string | null;
  cycle_view?: boolean;
  module_view?: boolean;
  page_view?: boolean;
  issue_views_view?: boolean;
  intake_view?: boolean;
  disabled_state_groups?: string[];
  states?: {
    client_id?: string;
    icon?: TStateIcon | null;
    name: string;
    color: string;
    group: string;
    default: boolean;
    allow_new_work_items?: boolean;
  }[];
  labels?: { client_id?: string; name: string; color: string }[];
  work_items?: TemplateWorkItemChild[];
  type_id?: string | null;
  logo_props?: TLogoProps;
  state_id?: string | null;
  assignee_ids?: string[];
  label_ids?: string[];
  module_ids?: string[];
  children?: TemplateWorkItemChild[];
};
export type TemplateOptions = {
  projects: { id: string; name: string }[];
  members: { member_id: string; member__display_name: string }[];
  states?: { id: string; name: string }[];
  labels?: { id: string; name: string }[];
  modules?: { id: string; name: string }[];
  assignees?: { member_id: string; member__display_name: string }[];
};
export type StateTemplateValues = {
  icon?: TStateIcon | null;
  name: string;
  group: string;
  color: string;
  default: boolean;
  allow_new_work_items: boolean;
};
export type StateTemplatePreview = {
  template: string;
  token: string;
  disabled_state_groups?: { before: string[]; after: string[] };
  matched: {
    index: number;
    id: string;
    values: StateTemplateValues;
    changes: Record<string, { before: unknown; after: unknown }>;
  }[];
  added: { index: number; id: null; values: StateTemplateValues }[];
  retained: { id: string; name: string; group: string; changes: Record<string, { before: unknown; after: unknown }> }[];
};
export type ConfigurationResource = "templates" | "project-categories/status" | "project-categories/label";
export const configurationKey = (slug: string, resource: ConfigurationResource) =>
  `workspace-configuration:${slug}:${resource}`;
export const projectConfigurationKey = (slug: string, projectId: string, resource = "templates") =>
  `project-configuration:${slug}:${projectId}:${resource}`;

export class WorkspaceConfigurationService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  private path(slug: string, resource: ConfigurationResource, id?: string) {
    return `/api/workspaces/${slug}/${resource}/${id ? `${id}/` : ""}`;
  }
  async list<T>(slug: string, resource: ConfigurationResource): Promise<T[]> {
    return (await this.get(this.path(slug, resource))).data;
  }
  async save<T>(slug: string, resource: ConfigurationResource, data: Partial<T> & { id?: string }): Promise<T> {
    return (
      data.id
        ? await this.patch(this.path(slug, resource, data.id), data)
        : await this.post(this.path(slug, resource), data)
    ).data;
  }
  async templateOptions(slug: string, project?: string): Promise<TemplateOptions> {
    return (await this.get(`/api/workspaces/${slug}/template-options/`, { params: project ? { project } : {} })).data;
  }
  async template(slug: string, id: string): Promise<WorkspaceTemplate> {
    return (await this.get(this.path(slug, "templates", id))).data;
  }
  private projectTemplatePath(slug: string, projectId: string, id?: string) {
    return `/api/workspaces/${slug}/projects/${projectId}/templates/${id ? `${id}/` : ""}`;
  }
  async listProjectTemplates(slug: string, projectId: string): Promise<WorkspaceTemplate[]> {
    return (await this.get(this.projectTemplatePath(slug, projectId))).data;
  }
  async projectTemplate(slug: string, projectId: string, id: string): Promise<WorkspaceTemplate> {
    return (await this.get(this.projectTemplatePath(slug, projectId, id))).data;
  }
  async saveProjectTemplate(
    slug: string,
    projectId: string,
    data: Partial<WorkspaceTemplate> & { id?: string }
  ): Promise<WorkspaceTemplate> {
    return (
      data.id
        ? await this.patch(this.projectTemplatePath(slug, projectId, data.id), data)
        : await this.post(this.projectTemplatePath(slug, projectId), data)
    ).data;
  }
  async removeProjectTemplate(slug: string, projectId: string, id: string): Promise<void> {
    await this.delete(this.projectTemplatePath(slug, projectId, id));
  }
  async projectTemplateOptions(slug: string, projectId: string): Promise<TemplateOptions> {
    return (await this.get(`/api/workspaces/${slug}/projects/${projectId}/template-options/`)).data;
  }
  async stateTemplate(
    slug: string,
    projectId: string,
    data: { mapping: Record<string, string>; token?: string; apply?: boolean }
  ): Promise<StateTemplatePreview> {
    return (await this.post(`/api/workspaces/${slug}/projects/${projectId}/state-template/`, data)).data;
  }
  async stateSettings(slug: string): Promise<{ enabled: boolean }> {
    return (await this.get(`/api/workspaces/${slug}/project-state-settings/`)).data;
  }
  async setStateSettings(slug: string, enabled: boolean): Promise<{ enabled: boolean }> {
    return (await this.patch(`/api/workspaces/${slug}/project-state-settings/`, { enabled })).data;
  }
  async reorder(slug: string, kind: "status" | "label", ids: string[]): Promise<void> {
    await this.post(`/api/workspaces/${slug}/project-categories/${kind}/order/`, { ids });
  }
  async remove(slug: string, resource: ConfigurationResource, id: string): Promise<void> {
    await this.delete(this.path(slug, resource, id));
  }
}
export const workspaceConfigurationService = new WorkspaceConfigurationService();
