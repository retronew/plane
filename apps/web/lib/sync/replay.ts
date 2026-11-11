/* eslint-disable no-await-in-loop -- Each page depends on the previous successfully applied cursor. */
import { mergeSyncContext, type SyncEngine, type SyncRefreshContext } from "./engine";

export type ReplayEvent = {
  type: "invalidate";
  protocol_version: 1;
  project_id: string;
  event_id: string;
  cursor: string;
  issue_ids?: string[];
  changed_fields?: string[];
  scopes?: string[];
  reset?: boolean;
};
export type ReplayPage = {
  cursor: string;
  events: ReplayEvent[];
  has_more: boolean;
  reset_required: boolean;
  project_ids: string[];
};
export type ReplaySource = (cursor: string | undefined, signal: AbortSignal) => Promise<ReplayPage>;

/** Only REST pages establish the workspace commit watermark; socket messages are wakeups. */
export class ReplayCoordinator {
  private cursor?: string;
  private active = false;
  private running = false;
  private pending = false;
  private generation = 0;
  private controller?: AbortController;
  private retry?: ReturnType<typeof setTimeout>;
  constructor(
    private engine: SyncEngine,
    private source: ReplaySource
  ) {}

  resume() {
    this.active = true;
    this.wake();
  }
  suspend() {
    this.active = false;
    this.generation++;
    this.controller?.abort();
    clearTimeout(this.retry);
    this.retry = undefined;
  }
  dispose() {
    this.suspend();
    this.cursor = undefined;
  }
  wake = () => {
    if (!this.active) return;
    this.pending = true;
    if (!this.running) void this.run();
  };
  private async run() {
    this.running = true;
    const generation = this.generation;
    const current = () => this.active && generation === this.generation;
    try {
      while (current() && this.pending) {
        this.pending = false;
        const controller = new AbortController();
        this.controller = controller;
        const page = await this.source(this.cursor, controller.signal);
        if (!current()) return;
        if (!/^\d+$/.test(page.cursor) || !Array.isArray(page.events) || !Array.isArray(page.project_ids))
          throw new Error("Invalid replay page");
        this.engine.updateProjects(page.project_ids);
        if (this.cursor === undefined || page.reset_required) {
          // Fix the baseline before reading snapshots so concurrent commits remain replayable.
          const baseline = page.cursor;
          await this.engine.apply(undefined, { reset: true });
          if (!current()) return;
          this.cursor = baseline;
          this.pending = true;
          continue;
        }
        let previous = BigInt(this.cursor);
        let malformed = BigInt(page.cursor) < previous;
        for (const event of page.events) {
          if (
            event.type !== "invalidate" ||
            event.protocol_version !== 1 ||
            typeof event.project_id !== "string" ||
            !/^\d+$/.test(event.cursor) ||
            BigInt(event.cursor) <= previous ||
            BigInt(event.cursor) > BigInt(page.cursor)
          ) {
            malformed = true;
            break;
          }
          previous = BigInt(event.cursor);
        }
        if (malformed) {
          this.cursor = undefined;
          this.pending = true;
          continue;
        }
        const projects = new Map<string, SyncRefreshContext>();
        for (const event of page.events) {
          const context: SyncRefreshContext = {
            issueIds: event.issue_ids,
            changedFields: event.changed_fields,
            reset: event.reset || !event.issue_ids?.length || !event.changed_fields?.length,
          };
          const previousContext = projects.get(event.project_id);
          const combined = previousContext ? mergeSyncContext(previousContext, context) : context;
          if ((combined.issueIds?.length ?? 0) > 1000) {
            combined.reset = true;
            combined.issueIds = undefined;
          }
          projects.set(event.project_id, combined);
        }
        await Promise.all([...projects].map(([projectId, context]) => this.engine.apply(projectId, context)));
        if (!current()) return;
        if (page.has_more && page.cursor === this.cursor) throw new Error("Replay page made no progress");
        this.cursor = page.cursor;
        this.pending ||= page.has_more;
      }
    } catch {
      if (current())
        this.retry = setTimeout(() => {
          this.retry = undefined;
          this.wake();
        }, 2000);
    } finally {
      this.running = false;
      if (this.active && generation !== this.generation) this.wake();
    }
  }
}
