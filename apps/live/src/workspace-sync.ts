import type { Request } from "express";
import type Redis from "ioredis";
import { WebSocket } from "ws";
import { logger } from "@plane/logger";
import { env } from "@/env";
import { redisManager } from "@/redis";
import { APIService } from "@/services/api.service";

export const WORKSPACE_SYNC_PATH = "/sync/workspaces/:workspaceSlug";
export const SYNC_CHANNEL = "plane:sync:v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type SyncMessage = {
  type: "ready" | "invalidate" | "resync" | "access_revoked";
  protocol_version: 1;
  project_id?: string;
  project_ids?: string[];
  issue_ids?: string[];
  event_id?: string;
};
type SyncEvent = SyncMessage & { workspace_id: string; workspace_slug: string; project_id: string };
export type SyncAccess = { workspace_id: string; workspace_slug: string; project_ids: string[] };
export interface SyncRepository {
  access(slug: string, cookie: string): Promise<SyncAccess>;
}
export class WorkspaceSyncAPI extends APIService implements SyncRepository {
  async access(slug: string, cookie: string): Promise<SyncAccess> {
    return (
      await this.get(`/api/workspaces/${encodeURIComponent(slug)}/sync/access/`, {
        headers: { Cookie: cookie },
        timeout: 5000,
      })
    ).data;
  }
}

export function parseSyncEvent(raw: string): SyncEvent | null {
  if (Buffer.byteLength(raw) > 16384) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const event = value as Partial<SyncEvent>;
    if (
      event.type !== "invalidate" ||
      event.protocol_version !== 1 ||
      typeof event.workspace_slug !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,99}$/.test(event.workspace_slug) ||
      typeof event.workspace_id !== "string" ||
      !UUID.test(event.workspace_id) ||
      typeof event.project_id !== "string" ||
      !UUID.test(event.project_id) ||
      typeof event.event_id !== "string" ||
      !UUID.test(event.event_id)
    )
      return null;
    if (
      event.issue_ids !== undefined &&
      (!Array.isArray(event.issue_ids) ||
        event.issue_ids.length > 100 ||
        !event.issue_ids.every((id) => typeof id === "string" && UUID.test(id)))
    )
      return null;
    // Explicit allowlist: Redis metadata or accidental content never reaches browsers.
    return {
      type: "invalidate",
      protocol_version: 1,
      workspace_id: event.workspace_id,
      workspace_slug: event.workspace_slug,
      project_id: event.project_id,
      event_id: event.event_id,
      ...(event.issue_ids ? { issue_ids: event.issue_ids } : {}),
    };
  } catch {
    return null;
  }
}

export function syncOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return env.CORS_ALLOWED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(origin);
}

type Connection = {
  socket: WebSocket;
  slug: string;
  cookie: string;
  access?: SyncAccess;
  pending: Map<string, SyncEvent>;
  resync: boolean;
  initial: boolean;
  checking: boolean;
  timer?: ReturnType<typeof setTimeout>;
  alive: boolean;
  closed: boolean;
};

export class WorkspaceSyncServer {
  private connections = new Set<Connection>();
  private subscriber: Redis | null = null;
  private checks = new Map<string, Promise<SyncAccess>>();
  private heartbeat: ReturnType<typeof setInterval>;
  private destroyed = false;

  constructor(private repository: SyncRepository = new WorkspaceSyncAPI()) {
    this.heartbeat = setInterval(() => {
      for (const connection of this.connections) {
        if (!connection.alive) {
          connection.socket.terminate();
          this.remove(connection);
          continue;
        }
        connection.alive = false;
        connection.socket.ping();
        this.schedule(connection);
      }
    }, 30000);
    this.heartbeat.unref();
  }

  initialize() {
    const client = redisManager.getClient();
    if (!client) throw new Error("Workspace sync requires Redis");
    this.subscriber = client.duplicate({ enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    this.subscriber.on("error", () => logger.warn("SYNC: Redis subscriber unavailable"));
    this.subscriber.on("ready", () => {
      void this.subscriber
        ?.subscribe(SYNC_CHANNEL)
        .then(() => {
          for (const connection of this.connections) {
            connection.resync = true;
            this.schedule(connection);
          }
          return undefined;
        })
        .catch(() => logger.warn("SYNC: Redis subscribe failed"));
    });
    this.subscriber.on("message", (channel, raw) => {
      if (channel !== SYNC_CHANNEL) return;
      const event = parseSyncEvent(raw);
      if (!event) return;
      for (const connection of this.connections) {
        if (connection.slug !== event.workspace_slug) continue;
        // Never send event identifiers until a fresh API check has allowed the project.
        const previous = connection.pending.get(event.project_id);
        connection.pending.set(event.project_id, previous ? { ...event, issue_ids: undefined } : event);
        if (connection.pending.size > 1000) {
          connection.pending.clear();
          connection.resync = true;
        }
        this.schedule(connection);
      }
    });
  }

  connect(socket: WebSocket, request: Request) {
    const slug = request.params.workspaceSlug;
    const cookie = request.headers.cookie;
    if (
      this.destroyed ||
      !syncOriginAllowed(request.headers.origin) ||
      !cookie ||
      typeof slug !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)
    ) {
      socket.close(1008, "Sync access denied");
      return;
    }
    const connection: Connection = {
      socket,
      slug,
      cookie,
      pending: new Map(),
      resync: false,
      initial: true,
      checking: false,
      alive: true,
      closed: false,
    };
    this.connections.add(connection);
    socket.on("pong", () => {
      connection.alive = true;
    });
    // This is a server-push protocol. No application messages are accepted.
    socket.on("message", () => socket.close(1008, "Server push only"));
    socket.on("close", () => this.remove(connection));
    socket.on("error", () => this.remove(connection));
    this.schedule(connection);
  }

  private remove(connection: Connection) {
    connection.closed = true;
    clearTimeout(connection.timer);
    connection.pending.clear();
    connection.cookie = "";
    this.connections.delete(connection);
  }

  private schedule(connection: Connection) {
    if (connection.closed || connection.timer || connection.checking) return;
    connection.timer = setTimeout(() => {
      connection.timer = undefined;
      void this.flush(connection);
    }, 25);
  }

  private access(connection: Connection) {
    // Share concurrent checks for tabs using the same session; never cache a grant.
    const key = `${connection.slug}\n${connection.cookie}`;
    let check = this.checks.get(key);
    if (!check) {
      check = this.repository.access(connection.slug, connection.cookie);
      this.checks.set(key, check);
      void check.finally(() => this.checks.delete(key)).catch(() => undefined);
    }
    return check;
  }

  private send(connection: Connection, message: SyncMessage) {
    if (connection.closed || connection.socket.readyState !== WebSocket.OPEN) return;
    if (connection.socket.bufferedAmount > 65536) {
      connection.socket.close(1013, "Sync client too slow");
      this.remove(connection);
      return;
    }
    const payload = JSON.stringify(message);
    if (Buffer.byteLength(payload) > 65536) {
      connection.socket.close(1009, "Sync message too large");
      this.remove(connection);
      return;
    }
    connection.socket.send(payload);
  }

  private async flush(connection: Connection) {
    if (connection.closed || connection.checking) return;
    connection.checking = true;
    const pending = connection.pending;
    connection.pending = new Map();
    const resync = connection.resync;
    connection.resync = false;
    try {
      const access = await this.access(connection);
      if (connection.closed) return;
      if (
        access.workspace_slug !== connection.slug ||
        !UUID.test(access.workspace_id) ||
        !Array.isArray(access.project_ids) ||
        !access.project_ids.every((id) => UUID.test(id))
      ) {
        throw new Error("Invalid sync access response");
      }
      const allowed = new Set(access.project_ids);
      for (const projectId of connection.access?.project_ids ?? []) {
        if (!allowed.has(projectId))
          this.send(connection, {
            type: "access_revoked",
            protocol_version: 1,
            project_id: projectId,
          });
      }
      const gained =
        connection.access !== undefined &&
        access.project_ids.some((id) => !connection.access?.project_ids.includes(id));
      connection.access = access;
      if (connection.initial) {
        this.send(connection, { type: "ready", protocol_version: 1, project_ids: access.project_ids });
        connection.initial = false;
      } else if (resync || gained)
        this.send(connection, {
          type: "resync",
          protocol_version: 1,
          project_ids: access.project_ids,
        });
      for (const event of pending.values()) {
        if (event.workspace_id !== access.workspace_id || !allowed.has(event.project_id)) continue;
        this.send(connection, {
          type: "invalidate",
          protocol_version: 1,
          project_id: event.project_id,
          event_id: event.event_id,
          ...(event.issue_ids ? { issue_ids: event.issue_ids } : {}),
        });
      }
    } catch (error) {
      const status = error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
      if (status === 401 || status === 403 || status === 404) {
        this.send(connection, { type: "access_revoked", protocol_version: 1 });
        connection.socket.close(1008, "Sync access revoked");
      } else {
        logger.warn("SYNC: Permission check unavailable");
        connection.socket.close(1013, "Sync permission service unavailable");
      }
      this.remove(connection);
    } finally {
      connection.checking = false;
      if (connection.pending.size || connection.resync) this.schedule(connection);
    }
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.heartbeat);
    for (const connection of this.connections) {
      connection.socket.close(1001, "Server shutting down");
      this.remove(connection);
    }
    this.subscriber?.removeAllListeners();
    this.subscriber?.disconnect();
    this.subscriber = null;
    this.checks.clear();
  }
}
