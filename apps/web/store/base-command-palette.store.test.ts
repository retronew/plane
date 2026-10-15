import { expect, it, vi } from "vitest";
import { BaseCommandPaletteStore } from "./base-command-palette.store";
vi.mock("@/lib/store-context", () => ({ store: { powerK: { isShortcutsListModalOpen: false } } }));
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
