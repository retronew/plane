import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type IssueCollaborationDocument = {
  can_read: boolean;
  can_edit: boolean;
  epoch: number;
  revision: number;
  format: string;
  description_html: string;
};

export function parseIssueCollaborationDocument(value: unknown): IssueCollaborationDocument {
  if (!value || typeof value !== "object") throw new Error("Invalid collaboration response");
  const data = value as Record<string, unknown>;
  if (
    data.can_read !== true ||
    typeof data.can_edit !== "boolean" ||
    typeof data.epoch !== "number" ||
    !Number.isSafeInteger(data.epoch) ||
    data.epoch < 0 ||
    typeof data.revision !== "number" ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 0 ||
    data.format !== "slate-yjs-v1" ||
    typeof data.description_html !== "string"
  ) {
    throw new Error("Invalid or inaccessible collaboration document");
  }
  return {
    can_read: true,
    can_edit: data.can_edit,
    epoch: data.epoch,
    revision: data.revision,
    format: data.format,
    description_html: data.description_html,
  };
}

export class IssueCollaborationService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async retrieve(workspaceSlug: string, projectId: string, issueId: string): Promise<IssueCollaborationDocument> {
    const response = await this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/collaboration/`
    );
    return parseIssueCollaborationDocument(response.data);
  }
}
