import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type PageCollaborationDocument = {
  format: string;
  schema_version: number;
  epoch: number;
  revision: number;
  description_html: string;
  name: string;
  can_read: boolean;
  can_edit: boolean;
};

export class PageCollaborationService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  async retrieve(workspaceSlug: string, projectId: string, pageId: string): Promise<PageCollaborationDocument> {
    const response = await this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/collaboration/`
    );
    return response.data;
  }
}
