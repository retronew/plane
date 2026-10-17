import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { useYjsSetup } from "../src/hooks/use-yjs-setup";

const mocks = vi.hoisted(() => ({ providers: [] as MockProvider[], caches: [] as MockPersistence[] }));

type ProviderOptions = {
  onSynced: () => void;
  onAuthenticationFailed: () => void;
};

class MockProvider {
  document = new Y.Doc();
  awareness = new Awareness(this.document);
  listeners = new Map<string, Set<(event: { event: { code: number } }) => void>>();
  configuration = {
    websocketProvider: { shouldConnect: true, disconnect: vi.fn(), connect: vi.fn(), destroy: vi.fn() },
  };
  destroy = vi.fn(() => {
    this.awareness.destroy();
    this.document.destroy();
  });
  disconnect = vi.fn();

  constructor(public options: ProviderOptions) {
    mocks.providers.push(this);
  }

  on(event: string, fn: (event: { event: { code: number } }) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: (event: { event: { code: number } }) => void) {
    this.listeners.get(event)?.delete(fn);
  }

  close(code = 1006) {
    this.listeners.get("close")?.forEach((fn) => fn({ event: { code } }));
  }
}

class MockPersistence {
  destroy = vi.fn();
  on = vi.fn();
  off = vi.fn();

  constructor(
    public name: string,
    public doc: Y.Doc
  ) {
    mocks.caches.push(this);
  }
}

vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("@hocuspocus/provider", () => ({
  HocuspocusProvider: function (options: ProviderOptions) {
    return new MockProvider(options);
  },
}));
vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: function (name: string, doc: Y.Doc) {
    return new MockPersistence(name, doc);
  },
}));

afterEach(() => {
  cleanup();
  mocks.providers.splice(0);
  mocks.caches.splice(0);
});

const args = {
  docId: "room-a",
  serverUrl: "ws://localhost",
  authToken: "token",
  editable: true,
  user: { id: "a", name: "Ada", color: "" },
};

it("re-subscribes in StrictMode and destroys each session exactly once", () => {
  const { result, unmount } = renderHook(() => useYjsSetup(args), { wrapper: StrictMode });
  expect(mocks.providers).toHaveLength(2);
  const [first, active] = mocks.providers;
  expect(first.destroy).toHaveBeenCalledTimes(1);
  expect(active.destroy).not.toHaveBeenCalled();
  expect(result.current?.provider).toBe(active);
  expect(active.awareness.getLocalState()?.user).toEqual({ id: "a", name: "Ada", avatar: null });
  unmount();
  for (const provider of mocks.providers) {
    expect(provider.destroy).toHaveBeenCalledTimes(1);
    expect(provider.configuration.websocketProvider.destroy).toHaveBeenCalledTimes(1);
    expect([...provider.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  }
  for (const cache of mocks.caches) expect(cache.destroy).toHaveBeenCalledTimes(1);
});

it("switches rooms, withdraws old presence, and keeps the replacement session on disconnect", () => {
  const onStateChange = vi.fn();
  const { result, rerender, unmount } = renderHook(({ docId }) => useYjsSetup({ ...args, docId, onStateChange }), {
    initialProps: { docId: "room-a" },
  });
  const first = mocks.providers[0];
  const clearPresence = vi.spyOn(first.awareness, "setLocalStateField");
  act(() => first.options.onSynced());
  expect(result.current?.state.isServerSynced).toBe(true);
  rerender({ docId: "room-b" });
  const active = mocks.providers[1];
  expect(first.destroy).toHaveBeenCalledTimes(1);
  expect(clearPresence).toHaveBeenCalledWith("user", null);
  expect(result.current?.provider).toBe(active);
  expect(result.current?.ydoc).toBe(active.document);
  expect(mocks.caches.at(-1)?.name).toBe("room-b");
  expect(mocks.caches.at(-1)?.doc).toBe(active.document);
  expect(active.awareness.getLocalState()?.user.id).toBe("a");
  act(() => active.close());
  expect(result.current?.state.stage).toEqual({ kind: "reconnecting", attempt: 1 });
  const callbackCount = onStateChange.mock.calls.length;
  act(() => {
    first.options.onSynced();
    first.options.onAuthenticationFailed();
  });
  expect(result.current?.state.stage).toEqual({ kind: "reconnecting", attempt: 1 });
  expect(onStateChange).toHaveBeenCalledTimes(callbackCount);
  act(() => active.close(4000));
  expect(result.current?.state.isServerDisconnected).toBe(true);
  expect(result.current?.provider).toBe(active);
  expect(onStateChange.mock.lastCall?.[0].stage.kind).toBe("disconnected");
  act(() => window.dispatchEvent(new Event("online")));
  expect(active.configuration.websocketProvider.connect).toHaveBeenCalledTimes(1);
  act(() => active.options.onSynced());
  expect(result.current?.state.isServerSynced).toBe(true);
  unmount();
  expect(active.destroy).toHaveBeenCalledTimes(1);
  expect(first.destroy).toHaveBeenCalledTimes(1);
});

it("uses the latest callback without recreating the connection when permissions change", () => {
  const firstCallback = vi.fn();
  const nextCallback = vi.fn();
  const { result, rerender } = renderHook(
    ({ editable, onStateChange }) => useYjsSetup({ ...args, editable, onStateChange }),
    { initialProps: { editable: true, onStateChange: firstCallback } }
  );
  const active = mocks.providers[0];
  rerender({ editable: false, onStateChange: nextCallback });
  expect(mocks.providers).toHaveLength(1);
  expect(active.awareness.getLocalState()?.user).toBeNull();
  act(() => active.options.onSynced());
  expect(nextCallback.mock.lastCall?.[0].stage.kind).toBe("synced");
  expect(firstCallback).toHaveBeenCalledTimes(1);
  expect(result.current?.provider).toBe(active);
});
