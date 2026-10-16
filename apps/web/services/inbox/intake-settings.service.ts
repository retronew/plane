import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type IntakeSettings = { id: string; notification_assignee: string | null };
export class IntakeSettingsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async retrieve(slug: string, projectId: string): Promise<IntakeSettings | null> {
    const response = await this.get(`/api/workspaces/${slug}/projects/${projectId}/intakes/`);
    return response.data;
  }
  async update(slug: string, projectId: string, id: string, receiver: string | null): Promise<IntakeSettings> {
    const response = await this.patch(`/api/workspaces/${slug}/projects/${projectId}/intakes/${id}/`, {
      notification_assignee: receiver,
    });
    return response.data;
  }
}
