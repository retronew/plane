import { API_BASE_URL } from "@plane/constants";
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
  project: string | null;
  configuration: TemplateConfiguration;
  name: string;
  title: string;
  description_html: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
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
  states?: { client_id?: string; name: string; color: string; group: string; default: boolean }[];
  labels?: { client_id?: string; name: string; color: string }[];
  work_items?: { client_id?: string; name: string; description_html: string }[];
  state_id?: string | null;
  assignee_ids?: string[];
  label_ids?: string[];
  module_ids?: string[];
  children?: { client_id?: string; name: string; description_html: string }[];
};
export type TemplateOptions = {
  projects: { id: string; name: string }[];
  members: { member_id: string; member__display_name: string }[];
  states?: { id: string; name: string }[];
  labels?: { id: string; name: string }[];
  modules?: { id: string; name: string }[];
  assignees?: { member_id: string; member__display_name: string }[];
};
export type ConfigurationResource = "templates" | "project-categories/status" | "project-categories/label";
export const configurationKey = (slug: string, resource: ConfigurationResource) =>
  `workspace-configuration:${slug}:${resource}`;

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
