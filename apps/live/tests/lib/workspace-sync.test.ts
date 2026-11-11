import { EventEmitter } from "node:events";
import type { Request } from "express";
import type WebSocket from "ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSyncEvent, syncOriginAllowed, WorkspaceSyncServer } from "@/workspace-sync";
import type { SyncRepository } from "@/workspace-sync";

const mocks = vi.hoisted(() => ({ duplicate: vi.fn() }));
vi.mock("@/redis", () => ({ redisManager: { getClient: () => ({ duplicate: mocks.duplicate }) } }));
vi.mock("@/env", () => ({ env: { CORS_ALLOWED_ORIGINS: "https://plane.test, https://second.test" } }));
vi.mock("@plane/logger", () => ({ logger: { warn: vi.fn() } }));
const workspace = "11111111-1111-4111-8111-111111111111";
const project = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const event = {
  type: "invalidate",
  protocol_version: 1,
  workspace_id: workspace,
  workspace_slug: "test",
  project_id: project,
  event_id: "44444444-4444-4444-8444-444444444444",
};
class Socket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  send = vi.fn();
  close = vi.fn();
  ping = vi.fn();
  terminate = vi.fn();
}
const request = {
  params: { workspaceSlug: "test" },
  headers: { cookie: "session=test", origin: "https://plane.test" },
} as unknown as Request;
let server: WorkspaceSyncServer;
let subscriber: EventEmitter & { subscribe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
let access: ReturnType<typeof vi.fn<SyncRepository["access"]>>;
const connect = () => {
  const socket = new Socket();
  server.connect(socket as unknown as WebSocket, request);
  return socket;
};
const push = (payload = event) => subscriber.emit("message", "plane:sync:v1", JSON.stringify(payload));
const messages = (socket: Socket) => socket.send.mock.calls.map(([raw]) => JSON.parse(raw));
beforeEach(() => {
  vi.useFakeTimers();
  subscriber = Object.assign(new EventEmitter(), { subscribe: vi.fn().mockResolvedValue(1), disconnect: vi.fn() });
  mocks.duplicate.mockReturnValue(subscriber);
  access = vi.fn().mockResolvedValue({ workspace_id: workspace, workspace_slug: "test", project_ids: [project] });
  server = new WorkspaceSyncServer({ access });
  server.initialize();
});
afterEach(() => {
  server.destroy();
  vi.useRealTimers();
});

describe("workspace sync security and lifecycle", () => {
  it("accepts only exact configured browser origins", () => {
    expect(syncOriginAllowed("https://plane.test")).toBe(true);
    expect(syncOriginAllowed("https://plane.test.evil")).toBe(false);
    expect(syncOriginAllowed(undefined)).toBe(false);
  });
  it("validates Redis events and strips content", () => {
    expect(parseSyncEvent(JSON.stringify({ ...event, name: "secret" }))).toEqual(event);
    expect(parseSyncEvent(JSON.stringify({ ...event, protocol_version: 2 }))).toBeNull();
    expect(parseSyncEvent(JSON.stringify({ ...event, issue_ids: ["invalid"] }))).toBeNull();
    expect(parseSyncEvent("x".repeat(17000))).toBeNull();
  });
  it("checks cookies on connect, coalesces bursts, and rechecks before sending", async () => {
    const socket = connect();
    await vi.advanceTimersByTimeAsync(30);
    expect(access).toHaveBeenCalledWith("test", "session=test");
    expect(messages(socket)[0]).toEqual({ type: "ready", protocol_version: 1, project_ids: [project] });
    push();
    push();
    push();
    await vi.advanceTimersByTimeAsync(30);
    expect(access).toHaveBeenCalledTimes(2);
    expect(messages(socket).filter((message) => message.type === "invalidate")).toHaveLength(1);
  });
  it("never forwards events from unauthorized projects or other workspaces", async () => {
    const socket = connect();
    await vi.advanceTimersByTimeAsync(30);
    push({ ...event, project_id: other });
    await vi.advanceTimersByTimeAsync(30);
    push({ ...event, workspace_id: other });
    await vi.advanceTimersByTimeAsync(30);
    expect(messages(socket)).toHaveLength(1);
  });
  it("checks permissions again after a project is revoked", async () => {
    const socket = connect();
    await vi.advanceTimersByTimeAsync(30);
    access.mockResolvedValue({ workspace_id: workspace, workspace_slug: "test", project_ids: [] });
    push();
    await vi.advanceTimersByTimeAsync(30);
    expect(messages(socket).at(-1)).toEqual({ type: "access_revoked", protocol_version: 1, project_id: project });
    expect(messages(socket).some((message) => message.type === "invalidate")).toBe(false);
  });
  it("resyncs when project access is restored", async () => {
    access.mockResolvedValueOnce({ workspace_id: workspace, workspace_slug: "test", project_ids: [] });
    const socket = connect();
    await vi.advanceTimersByTimeAsync(30);
    push();
    await vi.advanceTimersByTimeAsync(30);
    expect(messages(socket)).toContainEqual({ type: "resync", protocol_version: 1, project_ids: [project] });
  });
  it("revokes the workspace and closes on session expiration", async () => {
    const socket = connect();
    await vi.advanceTimersByTimeAsync(30);
    access.mockRejectedValue({ statusCode: 403 });
    push();
    await vi.advanceTimersByTimeAsync(30);
    expect(messages(socket).at(-1)).toEqual({ type: "access_revoked", protocol_version: 1 });
    expect(socket.close).toHaveBeenCalledWith(1008, "Sync access revoked");
  });
  it("resyncs after Redis subscription recovery", async () => {
    const socket = connect();
    await vi.advanceTimersByTimeAsync(30);
    subscriber.emit("ready");
    await vi.advanceTimersByTimeAsync(30);
    expect(messages(socket).at(-1)).toEqual({ type: "resync", protocol_version: 1, project_ids: [project] });
  });
  it("rechecks idle connections and cleans up closed sockets", async () => {
    const socket = connect();
    await vi.advanceTimersByTimeAsync(30);
    await vi.advanceTimersByTimeAsync(30000);
    expect(access).toHaveBeenCalledTimes(2);
    socket.emit("close");
    push();
    await vi.advanceTimersByTimeAsync(30000);
    expect(access).toHaveBeenCalledTimes(2);
  });
});
