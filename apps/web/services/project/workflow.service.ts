import { API_BASE_URL } from "@plane/constants";
import type {
  TProjectWorkflow,
  TProjectIssueHierarchy,
  THierarchyRequest,
  THierarchyPreview,
  THierarchyApplyResult,
  TProjectWorkflowList,
  TProjectIssueType,
  TProjectIssueTypeList,
  TWorkflowHistoryPage,
  TWorkflowTransition,
  TWorkflowImpactRequest,
  TWorkflowImpact,
  TWorkflowApproval,
  TWorkflowScript,
  TWorkflowScriptVersion,
  TWorkflowExecution,
  TWorkflowHttpPolicy,
  TWorkflowCredential,
} from "@plane/types";
import { APIService } from "@/services/api.service";

export class ProjectWorkflowService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }
  projectBase(slug: string, projectId: string) {
    return `/api/workspaces/${slug}/projects/${projectId}/`;
  }
  base(slug: string, projectId: string, workflowId = "default") {
    return `${this.projectBase(slug, projectId)}workflows/${workflowId}/`;
  }
  async list(slug: string, projectId: string): Promise<TProjectWorkflowList> {
    return (await this.get(`${this.projectBase(slug, projectId)}workflows/`, { timeout: 15000 })).data;
  }
  async retrieve(slug: string, projectId: string, workflowId = "default"): Promise<TProjectWorkflow> {
    return (await this.get(this.base(slug, projectId, workflowId), { timeout: 15000 })).data;
  }
  async create(
    slug: string,
    projectId: string,
    data: { name: string; description?: string; state_ids: string[]; initial_state_id?: string; version?: number }
  ): Promise<TProjectWorkflow> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflows/`, data)).data;
  }
  async update(
    slug: string,
    projectId: string,
    data: Partial<
      Pick<TProjectWorkflow, "enabled" | "is_active" | "initial_state_id" | "name" | "description" | "version">
    >,
    workflowId = "default"
  ): Promise<TProjectWorkflow> {
    return (await this.patch(this.base(slug, projectId, workflowId), data)).data;
  }
  async setCreation(
    slug: string,
    projectId: string,
    stateId: string,
    allow: boolean,
    workflowId = "default",
    version?: number
  ): Promise<TProjectWorkflow> {
    return (
      await this.patch(`${this.base(slug, projectId, workflowId)}states/`, {
        state_id: stateId,
        allow_creation: allow,
        version,
      })
    ).data;
  }
  async saveTransition(
    slug: string,
    projectId: string,
    data: Omit<TWorkflowTransition, "id">,
    id?: string,
    workflowId = "default",
    version?: number
  ): Promise<TProjectWorkflow> {
    const url = `${this.base(slug, projectId, workflowId)}transitions/${id ? `${id}/` : ""}`;
    return (await (id ? this.patch(url, { ...data, version }) : this.post(url, { ...data, version }))).data;
  }
  async deleteTransition(
    slug: string,
    projectId: string,
    id: string,
    workflowId = "default",
    version?: number
  ): Promise<TProjectWorkflow> {
    return (await this.delete(`${this.base(slug, projectId, workflowId)}transitions/${id}/`, { params: { version } }))
      .data;
  }
  async history(
    slug: string,
    projectId: string,
    offset = 0,
    options: { workflowId?: string; direction?: "asc" | "desc"; cursor?: string; watermark?: string } = {}
  ): Promise<TWorkflowHistoryPage> {
    const { workflowId, ...params } = options;
    return (
      await this.get(`${this.base(slug, projectId, workflowId)}activities/`, {
        params: { offset, ...params },
        timeout: 15000,
      })
    ).data;
  }
  async preview(slug: string, projectId: string, data: TWorkflowImpactRequest): Promise<TWorkflowImpact> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflows/preview/`, data)).data;
  }
  async apply(slug: string, projectId: string, data: TWorkflowImpactRequest & { token: string }): Promise<unknown> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflows/apply/`, data)).data;
  }
  async hierarchy(slug: string, projectId: string): Promise<TProjectIssueHierarchy> {
    return (await this.get(`${this.projectBase(slug, projectId)}issue-hierarchy/`, { timeout: 15000 })).data;
  }
  async previewHierarchy(slug: string, projectId: string, data: THierarchyRequest): Promise<THierarchyPreview> {
    return (await this.post(`${this.projectBase(slug, projectId)}issue-hierarchy/preview/`, data)).data;
  }
  async applyHierarchy(
    slug: string,
    projectId: string,
    data: THierarchyRequest & { token: string; confirm_detach: boolean }
  ): Promise<THierarchyApplyResult> {
    return (await this.post(`${this.projectBase(slug, projectId)}issue-hierarchy/apply/`, data)).data;
  }
  async types(slug: string, projectId: string): Promise<TProjectIssueTypeList> {
    return (await this.get(`${this.projectBase(slug, projectId)}issue-types/`)).data;
  }
  async saveType(
    slug: string,
    projectId: string,
    data: Partial<TProjectIssueType> & { version?: number },
    id?: string
  ): Promise<TProjectIssueType> {
    const url = `${this.projectBase(slug, projectId)}issue-types/${id ? `${id}/` : ""}`;
    return (await (id ? this.patch(url, data) : this.post(url, data))).data;
  }
  async approvals(
    slug: string,
    projectId: string,
    issueId: string
  ): Promise<{ pending: TWorkflowApproval | null; results: TWorkflowApproval[] }> {
    return (await this.get(`${this.projectBase(slug, projectId)}issues/${issueId}/approvals/`)).data;
  }
  async decide(
    slug: string,
    projectId: string,
    issueId: string,
    approvalId: string,
    data: { transition_id: string; outcome: "approve" | "reject"; version: number; idempotency_key: string }
  ): Promise<unknown> {
    return (
      await this.post(`${this.projectBase(slug, projectId)}issues/${issueId}/approvals/${approvalId}/decide/`, data)
    ).data;
  }
  async reapply(slug: string, projectId: string, issueId: string, version?: number): Promise<unknown> {
    return (await this.post(`${this.projectBase(slug, projectId)}issues/${issueId}/approvals/reapply/`, { version }))
      .data;
  }
  async scripts(slug: string, projectId: string): Promise<TWorkflowScript[]> {
    return (await this.get(`${this.projectBase(slug, projectId)}workflow-scripts/`)).data;
  }
  async createScript(
    slug: string,
    projectId: string,
    data: {
      name: string;
      description: string;
      source: string;
      capabilities: string[];
      http_policy: TWorkflowHttpPolicy;
    }
  ): Promise<TWorkflowScript> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflow-scripts/`, data)).data;
  }
  async publishVersion(
    slug: string,
    projectId: string,
    id: string,
    data: { source: string; capabilities: string[]; http_policy: TWorkflowHttpPolicy }
  ): Promise<TWorkflowScriptVersion> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflow-scripts/${id}/versions/`, data)).data;
  }
  async deleteScript(slug: string, projectId: string, id: string): Promise<unknown> {
    return (await this.delete(`${this.projectBase(slug, projectId)}workflow-scripts/${id}/`)).data;
  }
  async testScript(
    slug: string,
    projectId: string,
    data: {
      source: string;
      phase: "pre" | "post";
      issue_id?: string;
      context?: Record<string, unknown>;
      capabilities: string[];
      http_policy: TWorkflowHttpPolicy;
    }
  ): Promise<TWorkflowExecution> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflow-scripts/test/`, data)).data;
  }
  async executions(
    slug: string,
    projectId: string,
    offset = 0,
    workflowId?: string
  ): Promise<{ results: TWorkflowExecution[]; count: number; next_offset: number | null }> {
    return (
      await this.get(`${this.projectBase(slug, projectId)}workflow-executions/`, {
        params: { offset, ...(workflowId ? { workflow_id: workflowId } : {}) },
      })
    ).data;
  }
  async execution(slug: string, projectId: string, id: string): Promise<TWorkflowExecution> {
    return (await this.get(`${this.projectBase(slug, projectId)}workflow-executions/${id}/`)).data;
  }
  async retry(slug: string, projectId: string, id: string): Promise<TWorkflowExecution> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflow-executions/${id}/retry/`, {})).data;
  }
  async resolveExecution(
    slug: string,
    projectId: string,
    id: string,
    data: { resolution: "completed" | "abandoned"; note: string }
  ): Promise<TWorkflowExecution> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflow-executions/${id}/resolve/`, data)).data;
  }
  async credentials(slug: string, projectId: string): Promise<TWorkflowCredential[]> {
    return (await this.get(`${this.projectBase(slug, projectId)}workflow-credentials/`)).data;
  }
  async deleteCredential(slug: string, projectId: string, id: string): Promise<unknown> {
    return (await this.delete(`${this.projectBase(slug, projectId)}workflow-credentials/${id}/`)).data;
  }
  async createCredential(
    slug: string,
    projectId: string,
    data: { name: string; secret: string; header_name: string; origin: string }
  ): Promise<TWorkflowCredential> {
    return (await this.post(`${this.projectBase(slug, projectId)}workflow-credentials/`, data)).data;
  }
}
