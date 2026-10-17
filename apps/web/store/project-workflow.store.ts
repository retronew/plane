import { makeObservable, observable, runInAction } from "mobx";
import type { TProjectWorkflow, TProjectWorkflowList, TProjectIssueTypeList } from "@plane/types";
import { ProjectWorkflowService } from "@/services/project/workflow.service";

export class ProjectWorkflowStore {
  workflows: Record<string, TProjectWorkflow> = {};
  errors: Record<string, unknown> = {};
  lists: Record<string, TProjectWorkflowList> = {};
  issueTypes: Record<string, TProjectIssueTypeList> = {};
  historyRevision: Record<string, number> = {};
  private listPending = new Map<string, Promise<TProjectWorkflowList>>();
  private typePending = new Map<string, Promise<TProjectIssueTypeList>>();
  resolve = (projectId: string, typeId?: string | null): TProjectWorkflow | undefined => {
    const list = this.lists[projectId];
    const types = this.issueTypes[projectId]?.results;
    const type =
      typeId === undefined ? types?.find((item) => item.is_default) : types?.find((item) => item.id === typeId);
    if (type?.workflow_id) return list?.results.find((item) => (item.workflow_id ?? item.id) === type.workflow_id);
    return (
      list?.results.find((item) => item.issue_type_ids?.includes(typeId ?? "")) ??
      list?.results.find((item) => item.is_default) ??
      this.workflows[projectId]
    );
  };
  fetchList = (slug: string, projectId: string, force = false): Promise<TProjectWorkflowList> => {
    const key = `list:${projectId}`;
    const pending = this.listPending.get(projectId);
    if (pending)
      return force ? pending.catch(() => undefined).then(() => this.fetchList(slug, projectId, true)) : pending;
    const revision = this.revisions.get(projectId) ?? 0;
    if (!force && this.lists[projectId] && Date.now() - (this.fetchedAt.get(key) ?? 0) < 30000)
      return Promise.resolve(this.lists[projectId]);
    const request = this.service
      .list(slug, projectId)
      .then((list) => {
        if ((this.revisions.get(projectId) ?? 0) !== revision) return this.lists[projectId] ?? list;
        runInAction(() => {
          this.lists[projectId] = list;
          const defaultWorkflow = list.results.find((item) => item.is_default);
          if (defaultWorkflow) this.workflows[projectId] = defaultWorkflow;
        });
        this.fetchedAt.set(key, Date.now());
        return list;
      })
      .finally(() => this.listPending.delete(projectId));
    this.listPending.set(projectId, request);
    return request;
  };
  fetchTypes = (slug: string, projectId: string, force = false): Promise<TProjectIssueTypeList> => {
    const pending = this.typePending.get(projectId);
    if (pending)
      return force ? pending.catch(() => undefined).then(() => this.fetchTypes(slug, projectId, true)) : pending;
    const revision = this.revisions.get(projectId) ?? 0;
    const key = `types:${projectId}`;
    if (!force && this.issueTypes[projectId] && Date.now() - (this.fetchedAt.get(key) ?? 0) < 30000)
      return Promise.resolve(this.issueTypes[projectId]);
    const request = this.service
      .types(slug, projectId)
      .then((types) => {
        if ((this.revisions.get(projectId) ?? 0) !== revision) return this.issueTypes[projectId] ?? types;
        runInAction(() => {
          this.issueTypes[projectId] = types;
        });
        this.fetchedAt.set(key, Date.now());
        return types;
      })
      .finally(() => this.typePending.delete(projectId));
    this.typePending.set(projectId, request);
    return request;
  };
  refresh = async (slug: string, projectId: string) => {
    this.revisions.set(projectId, (this.revisions.get(projectId) ?? 0) + 1);
    await Promise.all([this.fetchList(slug, projectId, true), this.fetchTypes(slug, projectId, true)]);
    runInAction(() => {
      this.historyRevision[projectId] = (this.historyRevision[projectId] ?? 0) + 1;
    });
  };
  private fetchedAt = new Map<string, number>();
  private pending = new Map<string, Promise<TProjectWorkflow>>();
  private revisions = new Map<string, number>();
  service = new ProjectWorkflowService();
  constructor() {
    makeObservable(this, {
      workflows: observable,
      errors: observable,
      lists: observable,
      issueTypes: observable,
      historyRevision: observable,
    });
  }
  set(projectId: string, workflow: TProjectWorkflow) {
    this.revisions.set(projectId, (this.revisions.get(projectId) ?? 0) + 1);
    runInAction(() => {
      const list = this.lists[projectId];
      if (list) {
        const id = workflow.workflow_id ?? workflow.id;
        const index = list.results.findIndex((item) => (item.workflow_id ?? item.id) === id);
        if (index >= 0) list.results[index] = workflow;
        else list.results.push(workflow);
        list.enabled = workflow.enabled;
        if (workflow.policy_version !== undefined) list.policy_version = workflow.policy_version;
        for (const item of list.results) item.enabled = workflow.enabled;
      }
      if (!list || workflow.is_default || workflow.id === "default") this.workflows[projectId] = workflow;
      this.historyRevision[projectId] = (this.historyRevision[projectId] ?? 0) + 1;
      delete this.errors[projectId];
    });
    this.fetchedAt.set(projectId, Date.now());
  }
  refreshAfterStateChange = async (slug: string, projectId: string) => {
    // State edits must update the workflow's state list and effective initial state immediately.
    if (!this.workflows[projectId]) return;
    const pending = this.pending.get(projectId);
    if (pending) await pending.catch(() => undefined);
    const workflow = await this.fetch(slug, projectId, true);
    if (this.lists[projectId] || this.issueTypes[projectId]) await this.refresh(slug, projectId);
    return workflow;
  };
  fetch = (slug: string, projectId: string, force = false): Promise<TProjectWorkflow> => {
    const pending = this.pending.get(projectId);
    if (pending) return pending;
    if (!force && this.workflows[projectId] && Date.now() - (this.fetchedAt.get(projectId) ?? 0) < 30000)
      return Promise.resolve(this.workflows[projectId]);
    const revision = this.revisions.get(projectId) ?? 0;
    const request = this.service
      .retrieve(slug, projectId)
      .then((workflow) => {
        if ((this.revisions.get(projectId) ?? 0) !== revision) return this.workflows[projectId];
        runInAction(() => {
          this.workflows[projectId] = workflow;
          delete this.errors[projectId];
        });
        this.fetchedAt.set(projectId, Date.now());
        return workflow;
      })
      .catch((error: unknown) => {
        runInAction(() => {
          this.errors[projectId] = error;
        });
        throw error;
      })
      .finally(() => {
        this.pending.delete(projectId);
      });
    this.pending.set(projectId, request);
    return request;
  };
}
