import { API_BASE_URL } from "@plane/constants";
import type { TProjectWorkflow, TWorkflowActivity, TWorkflowTransition } from "@plane/types";
import { APIService } from "@/services/api.service";

export class ProjectWorkflowService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  base(slug: string, projectId: string) {
    return `/api/workspaces/${slug}/projects/${projectId}/workflows/default/`;
  }
  async retrieve(slug: string, projectId: string): Promise<TProjectWorkflow> {
    return (await this.get(this.base(slug, projectId), { timeout: 15000 })).data;
  }
  async update(
    slug: string,
    projectId: string,
    data: Partial<Pick<TProjectWorkflow, "enabled" | "is_active" | "initial_state_id">>
  ): Promise<TProjectWorkflow> {
    return (await this.patch(this.base(slug, projectId), data)).data;
  }
  async setCreation(slug: string, projectId: string, stateId: string, allow: boolean): Promise<TProjectWorkflow> {
    return (await this.patch(`${this.base(slug, projectId)}states/`, { state_id: stateId, allow_creation: allow }))
      .data;
  }
  async saveTransition(
    slug: string,
    projectId: string,
    data: Omit<TWorkflowTransition, "id">,
    id?: string
  ): Promise<TProjectWorkflow> {
    const url = `${this.base(slug, projectId)}transitions/${id ? `${id}/` : ""}`;
    return (await (id ? this.patch(url, data) : this.post(url, data))).data;
  }
  async deleteTransition(slug: string, projectId: string, id: string): Promise<TProjectWorkflow> {
    return (await this.delete(`${this.base(slug, projectId)}transitions/${id}/`)).data;
  }
  async history(
    slug: string,
    projectId: string,
    offset = 0
  ): Promise<{ results: TWorkflowActivity[]; next_offset: number | null; count: number }> {
    return (await this.get(`${this.base(slug, projectId)}activities/`, { params: { offset }, timeout: 15000 })).data;
  }
}
