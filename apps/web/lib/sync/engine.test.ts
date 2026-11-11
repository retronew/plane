import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncEngine, type SyncSocket } from "./engine";

class Socket implements SyncSocket {
  private listeners = new Map<string, (event: never) => unknown>();
  addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (event: WebSocketEventMap[K]) => unknown) {
    this.listeners.set(type, listener as (event: never) => unknown);
  }
  close = vi.fn();
  send = vi.fn();
  receive(message: object) {
    this.listeners.get("message")?.({ data: JSON.stringify({ protocol_version: 1, ...message }) } as never);
  }
  disconnect(code: number) {
    this.listeners.get("close")?.({ code } as never);
  }
}

describe("SyncEngine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  function setup() {
    const sockets: Socket[] = [];
    const report = vi.fn();
    const engine = new SyncEngine(() => {
      const socket = new Socket();
      sockets.push(socket);
      return socket;
    }, report);
    engine.connect("ws://localhost/sync/workspaces/test");
    return { engine, sockets, socket: sockets[0], report };
  }

  it("coalesces duplicate events and refreshes only matching projects and workspace queries", async () => {
    const { engine, socket } = setup();
    const projectA = vi.fn().mockResolvedValue(undefined);
    const projectB = vi.fn().mockResolvedValue(undefined);
    const workspace = vi.fn().mockResolvedValue(undefined);
    engine.subscribe({ key: "a", projectId: "a", refresh: projectA });
    engine.subscribe({ key: "b", projectId: "b", refresh: projectB });
    engine.subscribe({ key: "workspace", refresh: workspace });
    socket.receive({ type: "invalidate", project_id: "a", event_id: "one" });
    socket.receive({ type: "invalidate", project_id: "a", event_id: "one" });
    socket.receive({ type: "invalidate", project_id: "a", event_id: "two" });
    await vi.advanceTimersByTimeAsync(200);
    expect(projectA).toHaveBeenCalledTimes(1);
    expect(workspace).toHaveBeenCalledTimes(1);
    expect(projectB).not.toHaveBeenCalled();
    engine.disconnect();
  });

  it("serializes refreshes and reconciles an event received during an in-flight request", async () => {
    const { engine } = setup();
    let finish!: () => void;
    const refresh = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValue(undefined);
    engine.subscribe({ key: "list", refresh });
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1200);
    expect(refresh).toHaveBeenCalledTimes(2);
    engine.disconnect();
  });

  it("holds pending invalidations for nested mutations and changes the response revision", async () => {
    const { engine } = setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    engine.subscribe({ key: "list", refresh });
    const revision = engine.revision;
    const release = engine.pause();
    const releaseNested = engine.pause();
    expect(engine.revision).toBeGreaterThan(revision);
    engine.invalidate();
    release();
    await vi.advanceTimersByTimeAsync(500);
    expect(refresh).not.toHaveBeenCalled();
    releaseNested();
    releaseNested();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(engine.paused).toBe(false);
    engine.disconnect();
  });

  it("deduplicates mounted subscriptions by key and restores the previous callback on cleanup", async () => {
    const { engine } = setup();
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    engine.subscribe({ key: "same", refresh: first });
    const unsubscribe = engine.subscribe({ key: "same", refresh: second });
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    unsubscribe();
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    expect(first).toHaveBeenCalledTimes(1);
    engine.disconnect();
  });

  it("revokes access immediately while paused and restores refresh on a new ready allowlist", async () => {
    const { engine, socket } = setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const revoked = vi.fn();
    engine.subscribe({ key: "private", projectId: "a", refresh, onAccessRevoked: revoked });
    socket.receive({ type: "ready", project_ids: ["a"] });
    const release = engine.pause();
    socket.receive({ type: "access_revoked", project_id: "a" });
    expect(revoked).toHaveBeenCalledTimes(1);
    release();
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).not.toHaveBeenCalled();
    socket.receive({ type: "resync", project_ids: ["a"] });
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    engine.disconnect();
  });

  it("ignores messages from an old workspace and cancels reconnection on cleanup", async () => {
    const { engine, socket, sockets } = setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    engine.subscribe({ key: "list", refresh });
    engine.connect("ws://localhost/sync/workspaces/other");
    socket.receive({ type: "invalidate", project_id: "a" });
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).not.toHaveBeenCalled();
    sockets[1].disconnect(1006);
    engine.disconnect();
    await vi.advanceTimersByTimeAsync(40000);
    expect(sockets).toHaveLength(2);
  });

  it("ignores malformed events and backs off failed REST refreshes", async () => {
    const { engine, socket, report } = setup();
    const refresh = vi.fn().mockRejectedValue(new Error("offline"));
    engine.subscribe({ key: "list", refresh });
    socket.receive({ type: "invalidate" });
    socket.receive({ type: "invalidate", project_id: 123 });
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).not.toHaveBeenCalled();
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
    engine.disconnect();
  });
});
