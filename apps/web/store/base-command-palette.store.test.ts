import { beforeEach, expect, it, vi } from "vitest";
import { BaseCommandPaletteStore } from "./base-command-palette.store";
const context = vi.hoisted(() => ({
  projectId: "project" as string | undefined,
  project: { issue_views_view: true } as { issue_views_view?: boolean } | undefined,
}));
vi.mock("@/lib/store-context", () => ({
  store: {
    powerK: { isShortcutsListModalOpen: false },
    router: {
      get projectId() {
        return context.projectId;
      },
    },
    projectRoot: { project: { getPartialProjectById: () => (context.projectId ? context.project : undefined) } },
  },
}));
beforeEach(() => {
  context.projectId = "project";
  context.project = { issue_views_view: true };
});

it.each([undefined, {}, { issue_views_view: false }])(
  "does not open project view creation without an enabled feature: %j",
  (project) => {
    context.project = project;
    const store = new BaseCommandPaletteStore();
    store.toggleCreateViewModal(true);
    expect(store.isCreateViewModalOpen).toBe(false);
    store.toggleCreateViewModal();
    expect(store.isCreateViewModalOpen).toBe(false);
  }
);

it("opens enabled project views and still closes after the feature is disabled", () => {
  const store = new BaseCommandPaletteStore();
  store.toggleCreateViewModal(true);
  expect(store.isCreateViewModalOpen).toBe(true);
  context.project = { issue_views_view: false };
  store.toggleCreateViewModal(false);
  expect(store.isCreateViewModalOpen).toBe(false);
  context.project = { issue_views_view: true };
  store.toggleCreateViewModal();
  expect(store.isCreateViewModalOpen).toBe(true);
  context.project = undefined;
  store.toggleCreateViewModal();
  expect(store.isCreateViewModalOpen).toBe(false);
});

it("does not open the project view modal outside a project", () => {
  context.projectId = undefined;
  const store = new BaseCommandPaletteStore();
  store.toggleCreateViewModal(true);
  expect(store.isCreateViewModalOpen).toBe(false);
});

it("keeps project presets while closing, then clears them when opening from another entry", () => {
  const store = new BaseCommandPaletteStore();
  store.toggleCreateProjectModal(true, { status: "active", labels: ["backend"] });
  expect(store.isCreateProjectModalOpen).toBe(true);
  expect(store.createProjectModalData).toEqual({ status: "active", labels: ["backend"] });
  store.toggleCreateProjectModal(false);
  expect(store.createProjectModalData?.status).toBe("active");
  store.toggleCreateProjectModal(true);
  expect(store.createProjectModalData).toBeUndefined();
  store.toggleCreateProjectModal();
  expect(store.isCreateProjectModalOpen).toBe(false);
  store.toggleCreateProjectModal(true, { priority: "high" });
  expect(store.createProjectModalData).toEqual({ priority: "high" });
});
