import { beforeEach, expect, it, vi } from "vitest";
import type { CoreRootStore } from "./root.store";
import { ProjectViewStore } from "./project-view.store";
import { GlobalViewStore } from "./global-view.store";

const api = vi.hoisted(() => ({ createView: vi.fn(), createGlobalView: vi.fn() }));
vi.mock("@/services/view.service", () => ({
  ViewService: class {
    createView = api.createView;
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
