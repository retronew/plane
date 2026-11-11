export type SyncRefreshContext = { issueIds?: string[]; changedFields?: string[]; reset?: boolean };
export function mergeSyncContext(a?: SyncRefreshContext, b?: SyncRefreshContext): SyncRefreshContext {
  const issueIds = [...new Set([...(a?.issueIds ?? []), ...(b?.issueIds ?? [])])];
  const changedFields = [...new Set([...(a?.changedFields ?? []), ...(b?.changedFields ?? [])])];
  return {
    ...(issueIds.length ? { issueIds } : {}),
    ...(changedFields.length ? { changedFields } : {}),
    ...(!a?.issueIds?.length ||
    !b?.issueIds?.length ||
    !a?.changedFields?.length ||
    !b?.changedFields?.length ||
    a?.reset ||
    b?.reset
      ? { reset: true }
      : {}),
  };
}
export type SyncSubscription = {
  key: string;
  projectId?: string;
  refresh: (context?: SyncRefreshContext) => Promise<unknown>;
  /** Cancel query work on suspension; response consumers must also check revision. */
  abort?: () => void;
  onSuspend?: () => void;
  onAccessRevoked?: (projectId?: string) => void;
};

type Subscription = SyncSubscription & {
  token: symbol;
  cancelled: Promise<void>;
  cancel: () => void;
  refreshing: boolean;
};
type Entry = {
  subscribers: Subscription[];
  dirty: boolean;
  running: boolean;
  failures: number;
  context?: SyncRefreshContext;
};
export interface SyncSocket {
  addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (event: WebSocketEventMap[K]) => unknown
  ): void;
  close(): void;
  send(data: string): void;
}

type SyncMessage = {
  protocol_version: 1;
  type: "ready" | "invalidate" | "resync" | "access_revoked" | "ping";
  project_id?: string;
  project_ids?: string[];
  event_id?: string;
};

function parseMessage(data: unknown): SyncMessage | undefined {
  if (typeof data !== "string" || data.length > 64 * 1024) return;
  try {
    const message: unknown = JSON.parse(data);
    if (!message || typeof message !== "object") return;
    const value = message as Record<string, unknown>;
    if (
      value.protocol_version !== 1 ||
      !["ready", "invalidate", "resync", "access_revoked", "ping"].includes(String(value.type))
    )
      return;
    if (value.project_id !== undefined && typeof value.project_id !== "string") return;
    if (value.event_id !== undefined && typeof value.event_id !== "string") return;
    if (
      value.project_ids !== undefined &&
      (!Array.isArray(value.project_ids) || !value.project_ids.every((id) => typeof id === "string"))
    )
      return;
    // A malformed invalidation must never invalidate every project.
    if (value.type === "invalidate" && typeof value.project_id !== "string") return;
    return value as SyncMessage;
  } catch {
    return;
  }
}

/** Transport-independent invalidation engine. REST remains the source of truth.
 * Queries with the same key are coalesced, and never refreshed concurrently.
 * Notifications during a request cause one subsequent refresh, so an old response
 * cannot be the final state even when notifications are duplicated or reordered.
 */
export class SyncEngine {
  private entries = new Map<string, Entry>();
  private socket?: SyncSocket;
  private timer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private url?: string;
  private generation = 0;
  private attempts = 0;
  private suspended = false;
  private awaitingReady = false;
  private ready = false;
  private pauses = 0;
  private mutationRevision = 0;
  // Different query keys share entity and dictionary stores. Start each snapshot
  // only after the preceding one has committed, so a slow detail cannot undo a list.
  private refreshQueue: Promise<unknown> = Promise.resolve();
  get revision() {
    return this.mutationRevision;
  }
  get paused() {
    return this.suspended || this.pauses > 0;
  }
  private allowedProjects?: Set<string>;
  private seen = new Set<string>();
  private wakeReplay?: () => void;
  private waiters = new Set<{ resolve: () => void; reject: (error: unknown) => void }>();
  setReplay(wake?: () => void) {
    this.wakeReplay = wake;
  }
  reconcile() {
    if (this.suspended) return;
    if (this.wakeReplay) this.wakeReplay();
    else this.invalidate();
  }
  denyAccess() {
    this.revoke();
  }
  updateProjects(projectIds: string[]) {
    const projects = new Set(projectIds);
    for (const id of this.allowedProjects ?? []) if (!projects.has(id)) this.revoke(id);
    this.allowedProjects = projects;
    // Authenticated REST replay is sufficient even if the socket never becomes ready.
    this.ready = true;
    this.awaitingReady = false;
    this.schedule();
  }
  async apply(projectId?: string, context?: SyncRefreshContext) {
    this.invalidate(projectId, context);
    if (![...this.entries.values()].some((entry) => entry.dirty || entry.running)) return;
    return new Promise<void>((resolve, reject) => this.waiters.add({ resolve, reject }));
  }
  private settle(error?: unknown) {
    if (!error && [...this.entries.values()].some((entry) => entry.dirty || entry.running)) return;
    for (const waiter of this.waiters) {
      if (error) waiter.reject(error);
      else waiter.resolve();
    }
    this.waiters.clear();
  }

  constructor(
    private createSocket: (url: string) => SyncSocket,
    private reportError: (error: unknown) => void = (error) => console.warn("Task synchronization failed", error)
  ) {}

  subscribe(subscription: SyncSubscription) {
    let cancel!: () => void;
    const cancelled = new Promise<void>((resolve) => {
      cancel = resolve;
    });
    const subscriber = { ...subscription, token: Symbol(subscription.key), cancelled, cancel, refreshing: false };
    const entry = this.entries.get(subscription.key) ?? { subscribers: [], dirty: false, running: false, failures: 0 };
    entry.subscribers.push(subscriber);
    this.entries.set(subscription.key, entry);
    if (this.ready) {
      entry.dirty = true;
      this.schedule();
    }
    return () => {
      if (subscriber.refreshing) subscriber.abort?.();
      subscriber.cancel();
      entry.subscribers = entry.subscribers.filter(({ token }) => token !== subscriber.token);
      if (!entry.subscribers.length) this.entries.delete(subscription.key);
      this.settle();
    };
  }

  /** Hold remote refreshes while a local mutation or unsaved field is active. */
  pause() {
    this.mutationRevision++;
    this.pauses++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.pauses--;
      if (!this.pauses) this.schedule();
    };
  }

  invalidate(projectId?: string, context?: SyncRefreshContext) {
    for (const entry of this.entries.values()) {
      const subscription = entry.subscribers.at(-1);
      if (subscription && (!projectId || !subscription.projectId || subscription.projectId === projectId)) {
        entry.context = entry.dirty ? mergeSyncContext(entry.context, context) : context;
        entry.dirty = true;
      }
    }
    this.schedule();
  }

  connect(url: string) {
    // The initial connection must not cancel REST requests already started by
    // child mount effects. Replacing a workspace connection does invalidate them.
    if (this.url || this.socket) this.disconnect();
    this.url = url;
    this.open(this.generation);
  }

  /** Preserve workspace identity, permissions and local mutation holds. */
  suspend() {
    if (this.suspended) return;
    this.suspended = true;
    this.settle(new Error("Synchronization suspended"));
    this.generation++;
    this.mutationRevision++;
    // Aborted transports need not settle before a new generation can refresh.
    this.refreshQueue = Promise.resolve();
    this.ready = false;
    this.awaitingReady = true;
    clearTimeout(this.timer);
    clearTimeout(this.reconnectTimer);
    this.timer = undefined;
    this.reconnectTimer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
    for (const entry of this.entries.values()) {
      if (entry.running) {
        entry.running = false;
        entry.dirty = true;
        entry.context = { reset: true };
      }
      if (!this.wakeReplay) {
        entry.dirty = true;
        entry.context = undefined;
      }
      for (const subscriber of entry.subscribers) {
        subscriber.abort?.();
        subscriber.onSuspend?.();
      }
    }
  }

  /** Call only when the page is visible and online. Reconcile after authentication. */
  resume() {
    if (!this.suspended) return;
    this.suspended = false;
    if (this.url) {
      this.awaitingReady = true;
      this.open(this.generation);
    } else {
      this.awaitingReady = false;
      this.invalidate();
    }
  }

  disconnect() {
    this.settle(new Error("Synchronization disconnected"));
    this.generation++;
    this.mutationRevision++;
    // Aborted transports need not settle before a new generation can refresh.
    this.refreshQueue = Promise.resolve();
    this.url = undefined;
    this.ready = false;
    this.awaitingReady = false;
    clearTimeout(this.timer);
    clearTimeout(this.reconnectTimer);
    this.timer = undefined;
    this.reconnectTimer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
    this.allowedProjects = undefined;
    this.seen.clear();
    this.attempts = 0;
    for (const entry of this.entries.values()) {
      entry.dirty = false;
      entry.running = false;
    }
  }

  private open(generation: number) {
    if (this.suspended || !this.url || generation !== this.generation) return;
    try {
      const socket = this.createSocket(this.url);
      this.socket = socket;
      const current = () => this.socket === socket && generation === this.generation;
      // Reset backoff only after authenticated ready, not the TCP upgrade.
      socket.addEventListener("message", ({ data }) => {
        if (!current()) return;
        const message = parseMessage(data);
        if (!message) return;
        if (message.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", protocol_version: 1 }));
          return;
        }
        if (message.type === "access_revoked") {
          this.revoke(message.project_id);
          return;
        }
        if (message.project_ids) {
          const projects = new Set(message.project_ids);
          if (this.allowedProjects) {
            for (const id of this.allowedProjects) if (!projects.has(id)) this.revoke(id);
          }
          this.allowedProjects = projects;
        }
        if (message.type === "ready") {
          this.attempts = 0;
          this.ready = true;
          this.awaitingReady = false;
          this.schedule();
        }
        if (message.event_id) {
          if (this.seen.has(message.event_id)) return;
          this.seen.add(message.event_id);
          if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
        }
        if (this.wakeReplay) this.reconcile();
        else this.invalidate(message.type === "invalidate" ? message.project_id : undefined);
      });
      socket.addEventListener("error", () => {
        if (current()) socket.close();
      });
      socket.addEventListener("close", ({ code }) => {
        if (!current()) return;
        this.socket = undefined;
        this.ready = false;
        if (code === 4401 || code === 4403 || code === 1008) {
          this.revoke();
          return;
        }
        this.reconnect(generation);
      });
    } catch (error) {
      this.reportError(error);
      this.reconnect(generation);
    }
  }

  private reconnect(generation: number) {
    if (this.suspended || !this.url || generation !== this.generation) return;
    // A failed channel must not block foreground REST reconciliation forever.
    this.awaitingReady = false;
    this.reconcile();
    this.schedule();
    const delay = Math.min(1000 * 2 ** Math.min(this.attempts++, 5), 30000);
    this.reconnectTimer = setTimeout(() => this.open(generation), delay + Math.random() * delay * 0.2);
  }

  private revoke(projectId?: string) {
    // In-flight detail responses must not restore data after permission cleanup.
    this.mutationRevision++;
    if (projectId) this.allowedProjects?.delete(projectId);
    else this.allowedProjects = new Set();
    // Security cleanup is immediate, including while local editing is paused.
    for (const entry of this.entries.values()) {
      const subscription = entry.subscribers.at(-1);
      if (subscription && (!projectId || !subscription.projectId || subscription.projectId === projectId)) {
        entry.dirty = false;
        for (const subscriber of entry.subscribers) subscriber.onAccessRevoked?.(projectId);
        // Workspace queries must be rerun to exclude the revoked project.
        if (projectId && !subscription.projectId) entry.dirty = true;
      }
    }
    this.schedule();
    this.settle();
  }

  private schedule(delay = 150) {
    if (this.paused || this.awaitingReady || this.timer || ![...this.entries.values()].some((entry) => entry.dirty))
      return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, delay);
  }

  private flush() {
    if (this.paused || this.awaitingReady) return;
    for (const [key, entry] of this.entries) {
      const subscription = entry.subscribers.at(-1);
      if (!entry.dirty || entry.running || !subscription) continue;
      if (subscription.projectId && this.allowedProjects && !this.allowedProjects.has(subscription.projectId)) {
        entry.dirty = false;
        continue;
      }
      const context = entry.context;
      entry.context = undefined;
      entry.dirty = false;
      entry.running = true;
      const generation = this.generation;
      const refresh = this.refreshQueue
        .then(() => {
          if (
            generation !== this.generation ||
            this.entries.get(key) !== entry ||
            !entry.subscribers.includes(subscription)
          )
            return undefined;
          if (!this.paused) {
            subscription.refreshing = true;
            return Promise.race([subscription.refresh(context), subscription.cancelled]).finally(() => {
              subscription.refreshing = false;
            });
          }
          entry.context = entry.dirty ? mergeSyncContext(context, entry.context) : context;
          entry.dirty = true;
          return undefined;
        })
        .then(() => {
          if (generation !== this.generation) return undefined;
          entry.failures = 0;
          return undefined;
        })
        .catch((error: unknown) => {
          if (generation !== this.generation || this.entries.get(key) !== entry) return;
          this.reportError(error);
          // A bounded backoff avoids a request storm when REST is unavailable.
          entry.context = entry.dirty ? mergeSyncContext(context, entry.context) : context;
          entry.dirty = true;
          entry.failures++;
          this.settle(error);
        })
        .finally(() => {
          if (generation !== this.generation) return;
          entry.running = false;
          this.settle();
          if (this.entries.get(key) === entry && entry.dirty) {
            this.schedule(Math.min(1000 * 2 ** Math.min(entry.failures, 5), 30000));
          }
        });
      this.refreshQueue = refresh;
    }
    this.settle();
  }
}
