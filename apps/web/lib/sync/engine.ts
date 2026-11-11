export type SyncSubscription = {
  key: string;
  projectId?: string;
  refresh: () => Promise<unknown>;
  onAccessRevoked?: (projectId?: string) => void;
};

type Subscription = SyncSubscription & { token: symbol };
type Entry = { subscribers: Subscription[]; dirty: boolean; running: boolean; failures: number };
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
  private pauses = 0;
  private mutationRevision = 0;
  get revision() {
    return this.mutationRevision;
  }
  get paused() {
    return this.pauses > 0;
  }
  private allowedProjects?: Set<string>;
  private seen = new Set<string>();

  constructor(
    private createSocket: (url: string) => SyncSocket,
    private reportError: (error: unknown) => void = (error) => console.warn("Task synchronization failed", error)
  ) {}

  subscribe(subscription: SyncSubscription) {
    const subscriber = { ...subscription, token: Symbol(subscription.key) };
    const entry = this.entries.get(subscription.key) ?? { subscribers: [], dirty: false, running: false, failures: 0 };
    entry.subscribers.push(subscriber);
    this.entries.set(subscription.key, entry);
    return () => {
      entry.subscribers = entry.subscribers.filter(({ token }) => token !== subscriber.token);
      if (!entry.subscribers.length) this.entries.delete(subscription.key);
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

  invalidate(projectId?: string) {
    for (const entry of this.entries.values()) {
      const subscription = entry.subscribers.at(-1);
      if (subscription && (!projectId || !subscription.projectId || subscription.projectId === projectId))
        entry.dirty = true;
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

  disconnect() {
    this.generation++;
    this.mutationRevision++;
    this.url = undefined;
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
    for (const entry of this.entries.values()) entry.dirty = false;
  }

  private open(generation: number) {
    if (!this.url || generation !== this.generation) return;
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
        if (message.type === "ready") this.attempts = 0;
        if (message.event_id) {
          if (this.seen.has(message.event_id)) return;
          this.seen.add(message.event_id);
          if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
        }
        this.invalidate(message.type === "invalidate" ? message.project_id : undefined);
      });
      socket.addEventListener("error", () => {
        if (current()) socket.close();
      });
      socket.addEventListener("close", ({ code }) => {
        if (!current()) return;
        this.socket = undefined;
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
    if (!this.url || generation !== this.generation) return;
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
  }

  private schedule(delay = 150) {
    if (this.pauses || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, delay);
  }

  private flush() {
    if (this.pauses) return;
    for (const [key, entry] of this.entries) {
      const subscription = entry.subscribers.at(-1);
      if (!entry.dirty || entry.running || !subscription) continue;
      if (subscription.projectId && this.allowedProjects && !this.allowedProjects.has(subscription.projectId)) {
        entry.dirty = false;
        continue;
      }
      entry.dirty = false;
      entry.running = true;
      const generation = this.generation;
      void Promise.resolve()
        .then(subscription.refresh)
        .then(() => {
          entry.failures = 0;
          return undefined;
        })
        .catch((error: unknown) => {
          if (generation !== this.generation || this.entries.get(key) !== entry) return;
          this.reportError(error);
          // A bounded backoff avoids a request storm when REST is unavailable.
          entry.dirty = true;
          entry.failures++;
        })
        .finally(() => {
          entry.running = false;
          if (generation === this.generation && this.entries.get(key) === entry && entry.dirty) {
            this.schedule(Math.min(1000 * 2 ** Math.min(entry.failures, 5), 30000));
          }
        });
    }
  }
}
