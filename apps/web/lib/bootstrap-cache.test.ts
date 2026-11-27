import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IWorkspaceBootstrapResponse } from "@/services/bootstrap.service";
import { clearAllBootstrapCache, readWorkspaceBootstrapCache, writeWorkspaceBootstrapCache } from "./bootstrap-cache";

const sampleData: IWorkspaceBootstrapResponse = {
  workspace_member_me: null,
  project_roles: { p1: 20 },
  projects_mode: "partial",
  projects: [],
  members: [],
  favorites: [],
  states: [],
  sidebar_preferences: null,
  user_properties: null,
};

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("bootstrap-cache", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createMemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes, reads, isolates by user, expires after TTL, and clears all entries", () => {
    const t0 = 1_700_000_000_000;
    writeWorkspaceBootstrapCache("u1", "ws-a", sampleData, t0);

    expect(readWorkspaceBootstrapCache("u1", "ws-a", t0 + 1000)).toEqual(sampleData);
    expect(readWorkspaceBootstrapCache("u2", "ws-a", t0 + 1000)).toBeNull();
    expect(readWorkspaceBootstrapCache("u1", "ws-b", t0 + 1000)).toBeNull();

    // Expired after 5 minutes
    expect(readWorkspaceBootstrapCache("u1", "ws-a", t0 + 5 * 60 * 1000 + 1)).toBeNull();

    // Clear all removes only bootstrap keys
    window.localStorage.setItem("unrelated_key", "keep");
    writeWorkspaceBootstrapCache("u1", "ws-a", sampleData, t0);
    clearAllBootstrapCache();
    expect(readWorkspaceBootstrapCache("u1", "ws-a", t0 + 1000)).toBeNull();
    expect(window.localStorage.getItem("unrelated_key")).toBe("keep");
  });
});
