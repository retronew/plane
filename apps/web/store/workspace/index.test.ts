import { afterEach, expect, it, vi } from "vitest";
import { autorun, configure, runInAction } from "mobx";
import type { IWorkspace } from "@plane/types";
import type { CoreRootStore } from "@/store/root.store";
import { BaseWorkspaceRootStore } from "./index";

vi.mock("./home", () => ({ HomeStore: vi.fn(function () {}) }));
vi.mock("./webhook.store", () => ({ WebhookStore: vi.fn(function () {}) }));
vi.mock("./api-token.store", () => ({ ApiTokenStore: vi.fn(function () {}) }));

configure({ enforceActions: "always" });
afterEach(() => {
  vi.restoreAllMocks();
  configure({ enforceActions: "observed" });
});

it.each([false, true])("resets the observed loader inside an action (failure: %s)", async (fails) => {
  configure({ enforceActions: "always" });
  const store = new BaseWorkspaceRootStore({ router: {}, user: {} } as CoreRootStore);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const dispose = autorun(() => void store.loader);
  const error = new Error("offline");
  const workspace = { id: "w", slug: "workspace" } as IWorkspace;
  store.workspaceService.userWorkspaces = vi.fn(async () => {
    expect(store.loader).toBe(true);
    if (fails) throw error;
    return [workspace];
  });
  try {
    if (fails) await expect(store.fetchWorkspaces()).rejects.toThrow(error);
    else {
      await expect(store.fetchWorkspaces()).resolves.toEqual([workspace]);
      expect(store.workspaces.w).toEqual(workspace);
    }
    expect(store.loader).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});

it("deletes an observed workspace inside an action after the request resolves", async () => {
  configure({ enforceActions: "always" });
  const store = new BaseWorkspaceRootStore({ router: {}, user: {} } as CoreRootStore);
  runInAction(() => {
    store.workspaces.w = { id: "w", slug: "workspace" } as IWorkspace;
  });
  const dispose = autorun(() => void Object.keys(store.workspaces));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  store.workspaceService.deleteWorkspace = vi.fn().mockResolvedValue(undefined);
  try {
    await store.deleteWorkspace("workspace");
    expect(store.workspaces.w).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});
