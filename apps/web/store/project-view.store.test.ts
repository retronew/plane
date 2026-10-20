import { beforeEach, expect, it, vi } from "vitest";
import type { CoreRootStore } from "./root.store";
import type { IProjectView } from "@plane/types";
import { ProjectViewStore } from "./project-view.store";
import { GlobalViewStore } from "./global-view.store";

const api = vi.hoisted(() => ({
  createView: vi.fn(),
  createGlobalView: vi.fn(),
  setViewLock: vi.fn(),
  patchView: vi.fn(),
}));
vi.mock("@/services/view.service", () => ({
  ViewService: class {
    createView = api.createView;
    setViewLock = api.setViewLock;
    patchView = api.patchView;
  },
}));
vi.mock("@/services/workspace.service", () => ({
  WorkspaceService: class {
    createView = api.createGlobalView;
  },
}));
const context = {
  project: { issue_views_view: true } as { issue_views_view?: boolean } | undefined,
};
const getPartialProjectById = vi.fn((projectId: string) => (projectId === "project" ? context.project : undefined));
const root = { projectRoot: { project: { getPartialProjectById } } } as unknown as CoreRootStore;
beforeEach(() => {
  vi.clearAllMocks();
  context.project = { issue_views_view: true };
  api.createView.mockResolvedValue({ id: "project-view", name: "View", project: "project" });
  api.createGlobalView.mockResolvedValue({ id: "workspace-view", name: "View" });
});

it.each([undefined, {}, { issue_views_view: false }])(
  "rejects creation before sending a request when the target project is unavailable: %j",
  async (project) => {
    context.project = project;
    const store = new ProjectViewStore(root);
    await expect(store.createView("workspace", "project", { name: "View" })).rejects.toThrow();
    expect(api.createView).not.toHaveBeenCalled();
    expect(store.viewMap).toEqual({});
  }
);

it("checks the target project and permits enabled project creation", async () => {
  const store = new ProjectViewStore(root);
  await expect(store.createView("workspace", "other-project", { name: "View" })).rejects.toThrow();
  expect(api.createView).not.toHaveBeenCalled();
  const response = await store.createView("workspace", "project", { name: "View" });
  expect(getPartialProjectById).toHaveBeenLastCalledWith("project");
  expect(api.createView).toHaveBeenCalledOnce();
  expect(store.viewMap[response.id]).toEqual(response);
});

it("rechecks the feature on each create call", async () => {
  const store = new ProjectViewStore(root);
  await store.createView("workspace", "project", { name: "View" });
  context.project = { issue_views_view: false };
  await expect(store.createView("workspace", "project", { name: "Another view" })).rejects.toThrow();
  expect(api.createView).toHaveBeenCalledOnce();
});

it("does not overwrite a locked view when the server rejects an edit", async () => {
  const store = new ProjectViewStore(root);
  store.viewMap.view = { id: "view", name: "Original", is_locked: true } as IProjectView;
  api.patchView.mockRejectedValueOnce(new Error("view is locked"));
  await expect(store.updateView("workspace", "project", "view", { name: "Changed" })).rejects.toThrow();
  expect(store.viewMap.view.name).toBe("Original");
});

it("updates lock state only after a successful request and preserves it on failure", async () => {
  const store = new ProjectViewStore(root);
  store.viewMap.view = { id: "view", is_locked: false } as IProjectView;
  api.setViewLock.mockResolvedValueOnce(undefined);
  await store.setViewLock("workspace", "project", "view", true);
  expect(api.setViewLock).toHaveBeenCalledWith("workspace", "project", "view", true);
  expect(store.viewMap.view.is_locked).toBe(true);
  api.setViewLock.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(store.setViewLock("workspace", "project", "view", false)).rejects.toThrow("Forbidden");
  expect(store.viewMap.view.is_locked).toBe(true);
  api.setViewLock.mockResolvedValueOnce(undefined);
  await store.setViewLock("workspace", "project", "view", false);
  expect(store.viewMap.view.is_locked).toBe(false);
});

it("allows workspace views when project views are disabled or unloaded", async () => {
  const store = new GlobalViewStore(root);
  context.project = { issue_views_view: false };
  await store.createGlobalView("workspace", { name: "View" });
  context.project = undefined;
  await store.createGlobalView("workspace", { name: "Another view" });
  expect(api.createGlobalView).toHaveBeenCalledTimes(2);
  expect(getPartialProjectById).not.toHaveBeenCalled();
  expect(store.globalViewMap["workspace-view"]).toBeDefined();
});
