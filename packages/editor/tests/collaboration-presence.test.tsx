import { afterEach, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import {
  clearCollaborationUser,
  getCollaborationUsers,
  publishCollaborationUser,
  subscribeCollaborationUsers,
} from "../src/helpers/collaboration-presence";
import type { CollaborationPresenceProvider } from "../src/helpers/collaboration-presence";

const docs: Y.Doc[] = [];
const awarenessInstances: Awareness[] = [];
function client() {
  const doc = new Y.Doc();
  docs.push(doc);
  const awareness = new Awareness(doc);
  awarenessInstances.push(awareness);
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  const provider = {
    awareness,
    status: "connected",
    isConnected: true,
    on(event: string, fn: (...args: any[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off(event: string, fn: (...args: any[]) => void) {
      listeners.get(event)?.delete(fn);
    },
  } as unknown as CollaborationPresenceProvider;
  const emit = (event: string, data?: unknown) => listeners.get(event)?.forEach((fn) => fn(data));
  const status = (value: string) => {
    provider.status = value as typeof provider.status;
    emit("status", { status: value });
  };
  return { provider, awareness, emit, status, listeners };
}
function exchange(from: ReturnType<typeof client>, to: ReturnType<typeof client>) {
  applyAwarenessUpdate(
    to.awareness,
    encodeAwarenessUpdate(from.awareness, [...from.awareness.getStates().keys()]),
    "test"
  );
}
afterEach(() => {
  awarenessInstances.splice(0).forEach((a) => a.destroy());
  docs.splice(0).forEach((d) => d.destroy());
});

it("exchanges real awareness messages, deduplicates tabs, strips private data and recovers after disconnect", () => {
  const a = client(),
    b = client(),
    tab = client();
  publishCollaborationUser(
    a.provider,
    { id: "a", name: "Ada", avatar: "/ada.png", color: "red", cookie: "secret" },
    true
  );
  publishCollaborationUser(b.provider, { id: "b", name: "Bo", color: "blue" }, true);
  publishCollaborationUser(tab.provider, { id: "b", name: "Bo", color: "blue" }, true);
  exchange(b, a);
  exchange(tab, a);
  expect(getCollaborationUsers(a.provider)).toEqual([
    { id: "a", name: "Ada", avatar: "/ada.png" },
    { id: "b", name: "Bo", avatar: null },
  ]);
  expect(a.awareness.getLocalState()?.user).not.toHaveProperty("cookie");
  const change = vi.fn();
  const unsubscribe = subscribeCollaborationUsers(a.provider, change);
  a.awareness.setLocalStateField("cursor", { x: 1 });
  expect(change).not.toHaveBeenCalled();
  a.status("disconnected");
  expect(change).toHaveBeenLastCalledWith([]);
  expect(getCollaborationUsers(a.provider)).toEqual([]);
  a.status("connected");
  expect(change.mock.lastCall?.[0]).toHaveLength(2);
  clearCollaborationUser(b.provider);
  exchange(b, a);
  expect(getCollaborationUsers(a.provider)).toHaveLength(2);
  clearCollaborationUser(tab.provider);
  exchange(tab, a);
  expect(getCollaborationUsers(a.provider)).toHaveLength(1);
  a.emit("destroy");
  expect(change).toHaveBeenLastCalledWith([]);
  expect(getCollaborationUsers(a.provider)).toEqual([]);
  unsubscribe();
  expect([...a.listeners.values()].every((set) => !set.size)).toBe(true);
});

it("withdraws presence for permissions and unmount, while preserving unrelated awareness", () => {
  const a = client();
  a.awareness.setLocalStateField("cursor", 42);
  const user = { id: "a", name: "Ada", color: "red" };
  const cleanup = publishCollaborationUser(a.provider, user, true);
  cleanup();
  expect(a.awareness.getLocalState()).toEqual({ cursor: 42, user: null });
  publishCollaborationUser(a.provider, user, true);
  publishCollaborationUser(a.provider, user, false);
  expect(getCollaborationUsers(a.provider)).toEqual([]);
  publishCollaborationUser(a.provider, { ...user, id: " " }, true);
  expect(getCollaborationUsers(a.provider)).toEqual([]);
});

it("normalizes untrusted profiles and clears all faces on close even before status updates", () => {
  const a = client();
  a.awareness.setLocalStateField("user", { id: "a", name: 123, avatar: {}, cookie: "private" });
  expect(getCollaborationUsers(a.provider)).toEqual([{ id: "a", name: "", avatar: null }]);
  const change = vi.fn();
  const stop = subscribeCollaborationUsers(a.provider, change);
  a.emit("close");
  expect(change).toHaveBeenLastCalledWith([]);
  a.awareness.setLocalStateField("cursor", 1);
  expect(change).toHaveBeenCalledTimes(1);
  a.status("connected");
  expect(change.mock.lastCall?.[0]).toHaveLength(1);
  stop();
});
