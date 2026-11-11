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

  it("serializes detail and list snapshots sharing entities even across different keys", async () => {
    const { engine, socket } = setup();
    let release!: () => void;
    let entity = "cached";
    const detail = vi.fn(async () => {
      const snapshot = "detail snapshot";
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      entity = snapshot;
    });
    const list = vi.fn(async () => {
      entity = "new list snapshot";
    });
    engine.subscribe({ key: "detail", refresh: detail });
    engine.subscribe({ key: "list", refresh: list });
    socket.receive({ type: "ready" });
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    expect(detail).toHaveBeenCalledOnce();
    expect(list).not.toHaveBeenCalled();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(list).toHaveBeenCalledOnce();
    expect(entity).toBe("new list snapshot");
  });

  it.each(["unsubscribe", "failure"])(
    "continues the queue after %s and rejects late cancelled snapshots",
    async (mode) => {
      const { engine, socket } = setup();
      let release!: () => void;
      const controller = new AbortController();
      const abort = vi.fn(() => controller.abort());
      let entity = "cached";
      const remove = engine.subscribe({
        key: "detail",
        abort,
        refresh: async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          if (mode === "failure") throw new Error("offline");
          if (!controller.signal.aborted) entity = "stale detail";
        },
      });
      const list = vi.fn(async () => {
        entity = "current list";
      });
      engine.subscribe({ key: "list", refresh: list });
      socket.receive({ type: "ready" });
      engine.invalidate();
      await vi.advanceTimersByTimeAsync(200);
      if (mode === "unsubscribe") remove();
      else release();
      await vi.advanceTimersByTimeAsync(0);
      expect(list).toHaveBeenCalledOnce();
      if (mode === "unsubscribe") {
        expect(abort).toHaveBeenCalledOnce();
        release();
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(entity).toBe("current list");
    }
  );

  it.each(["suspend", "disconnect"])("releases a hung refresh queue across %s generations", async (mode) => {
    const { engine, socket, sockets } = setup();
    const hung = vi.fn(() => new Promise<void>(() => {}));
    const remove = engine.subscribe({ key: "old-detail", refresh: hung });
    socket.receive({ type: "ready" });
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    if (mode === "suspend") engine.suspend();
    else engine.disconnect();
    remove();
    const list = vi.fn().mockResolvedValue(undefined);
    engine.subscribe({ key: "new-list", refresh: list });
    if (mode === "suspend") engine.resume();
    else engine.connect("ws://localhost/new-workspace");
    sockets.at(-1)!.receive({ type: "ready" });
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    expect(list).toHaveBeenCalledOnce();
  });

  it("suspends transport and timers, preserves holds, and reconciles once after ready", async () => {
    const { engine, socket, sockets } = setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const abort = vi.fn();
    const onSuspend = vi.fn();
    engine.subscribe({ key: "list", refresh, abort, onSuspend });
    const release = engine.pause();
    const nested = engine.pause();
    engine.invalidate();
    const revision = engine.revision;
    engine.suspend();
    engine.suspend();
    expect(engine.revision).toBeGreaterThan(revision);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(onSuspend).toHaveBeenCalledTimes(1);
    expect(socket.close).toHaveBeenCalledTimes(1);
    socket.disconnect(1006);
    socket.receive({ type: "ready" });
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh).not.toHaveBeenCalled();
    expect(sockets).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    engine.resume();
    engine.resume();
    engine.invalidate();
    release();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).not.toHaveBeenCalled();
    sockets[1].receive({ type: "ready", project_ids: ["a"] });
    nested();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(2);
    engine.disconnect();
  });

  it("cancels reconnect and rejects an old response revision across suspension", async () => {
    const { engine, socket, sockets } = setup();
    let finish!: () => void;
    let applied = false;
    const refresh = vi
      .fn()
      .mockImplementationOnce(async () => {
        const revision = engine.revision;
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        if (revision === engine.revision && !engine.paused) applied = true;
      })
      .mockResolvedValue(undefined);
    engine.subscribe({ key: "list", refresh });
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    socket.disconnect(1006);
    engine.suspend();
    await vi.advanceTimersByTimeAsync(60000);
    expect(sockets).toHaveLength(1);
    engine.resume();
    sockets[1].receive({ type: "ready" });
    await vi.advanceTimersByTimeAsync(200);
    finish();
    await vi.advanceTimersByTimeAsync(1200);
    expect(applied).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(2);
    engine.disconnect();
  });

  it("calibrates a subscription mounted after ready and preserves permissions on resume", async () => {
    const { engine, socket, sockets } = setup();
    socket.receive({ type: "ready", project_ids: ["a"] });
    const refresh = vi.fn().mockResolvedValue(undefined);
    engine.subscribe({ key: "new", projectId: "a", refresh });
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    engine.suspend();
    engine.resume();
    sockets[1].receive({ type: "ready", project_ids: [] });
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    engine.disconnect();
  });

  it("keeps foreground reconciliation available when the resumed channel fails", async () => {
    const { engine, sockets } = setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    engine.subscribe({ key: "list", refresh });
    engine.suspend();
    engine.resume();
    sockets[1].disconnect(1006);
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(2);
    engine.suspend();
    expect(vi.getTimerCount()).toBe(0);
    engine.disconnect();
  });

  it("does not create a socket when mounted suspended and cleans up before resume", async () => {
    const createSocket = vi.fn(() => new Socket());
    const engine = new SyncEngine(createSocket);
    engine.suspend();
    engine.connect("ws://localhost/test");
    engine.invalidate();
    await vi.advanceTimersByTimeAsync(60000);
    expect(createSocket).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    engine.disconnect();
    engine.resume();
    expect(createSocket).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

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

it("unions coalesced context and preserves it through failure", async () => {
  vi.useFakeTimers();
  const engine = new SyncEngine(
    () => new Socket(),
    () => {}
  );
  const refresh = vi.fn().mockRejectedValueOnce(new Error("retry")).mockResolvedValue(undefined);
  engine.subscribe({ key: "list", refresh });
  engine.invalidate("p", { issueIds: ["a"], changedFields: ["name"] });
  engine.invalidate("p", { issueIds: ["b"], changedFields: ["priority"] });
  await vi.advanceTimersByTimeAsync(200);
  await vi.advanceTimersByTimeAsync(2000);
  expect(refresh).toHaveBeenNthCalledWith(2, { issueIds: ["a", "b"], changedFields: ["name", "priority"] });
  engine.invalidate("p", { issueIds: ["c"], changedFields: ["name"] });
  engine.invalidate("p");
  await vi.advanceTimersByTimeAsync(200);
  expect(refresh).toHaveBeenLastCalledWith({ issueIds: ["c"], changedFields: ["name"], reset: true });
  engine.disconnect();
  vi.useRealTimers();
});

it("uses sockets only to wake replay without trusting their cursor", async () => {
  vi.useFakeTimers();
  const socket = new Socket();
  const engine = new SyncEngine(() => socket);
  const wake = vi.fn();
  const refresh = vi.fn().mockResolvedValue(undefined);
  engine.subscribe({ key: "list", projectId: "p", refresh });
  engine.setReplay(wake);
  engine.connect("ws://localhost/test");
  socket.receive({ type: "ready", project_ids: ["p"], cursor: "999" });
  socket.receive({ type: "invalidate", project_id: "p", cursor: "1000" });
  await vi.advanceTimersByTimeAsync(200);
  expect(wake).toHaveBeenCalledTimes(2);
  expect(refresh).not.toHaveBeenCalled();
  const applied = engine.apply("p", { issueIds: ["i"], changedFields: ["name"] });
  await vi.advanceTimersByTimeAsync(200);
  await applied;
  expect(refresh).toHaveBeenCalledExactlyOnceWith({ issueIds: ["i"], changedFields: ["name"] });
  engine.disconnect();
  vi.useRealTimers();
});

it("accepts REST permissions to reconcile without a ready socket", async () => {
  vi.useFakeTimers();
  const engine = new SyncEngine(() => new Socket());
  engine.setReplay(() => {});
  engine.connect("ws://localhost/test");
  engine.suspend();
  engine.resume();
  const refresh = vi.fn().mockResolvedValue(undefined);
  engine.subscribe({ key: "list", projectId: "p", refresh });
  engine.updateProjects(["p"]);
  const applied = engine.apply(undefined, { reset: true });
  await vi.advanceTimersByTimeAsync(200);
  await applied;
  expect(refresh).toHaveBeenCalledOnce();
  const late = vi.fn().mockResolvedValue(undefined);
  engine.subscribe({ key: "late", projectId: "p", refresh: late });
  await vi.advanceTimersByTimeAsync(200);
  expect(late).toHaveBeenCalledOnce();
  engine.disconnect();
  vi.useRealTimers();
});
