import { makeObservable, observable, runInAction } from "mobx";
import type { TProjectWorkflow } from "@plane/types";
import { ProjectWorkflowService } from "@/services/project/workflow.service";

export class ProjectWorkflowStore {
  workflows: Record<string, TProjectWorkflow> = {};
  errors: Record<string, unknown> = {};
  private fetchedAt = new Map<string, number>();
  private pending = new Map<string, Promise<TProjectWorkflow>>();
  private revisions = new Map<string, number>();
  service = new ProjectWorkflowService();
  constructor() {
    makeObservable(this, { workflows: observable, errors: observable });
  }
  set(projectId: string, workflow: TProjectWorkflow) {
    this.revisions.set(projectId, (this.revisions.get(projectId) ?? 0) + 1);
    runInAction(() => {
      this.workflows[projectId] = workflow;
      delete this.errors[projectId];
    });
    this.fetchedAt.set(projectId, Date.now());
  }
  refreshAfterStateChange = async (slug: string, projectId: string) => {
    // State edits must update the workflow's state list and effective initial state immediately.
    if (!this.workflows[projectId]) return;
    const pending = this.pending.get(projectId);
    if (pending) await pending.catch(() => undefined);
    return this.fetch(slug, projectId, true);
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
        this.set(projectId, workflow);
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
