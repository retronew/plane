import { describe, expect, it, vi } from "vitest";
import { runInAction } from "mobx";
import type { ICycle, IModule } from "@plane/types";
import type { CoreRootStore } from "./root.store";
import { CycleStore } from "./cycle.store";
import { ModulesStore } from "./module.store";

const root = () =>
  ({
    router: { projectId: "project" },
    cycleFilter: { getArchivedFiltersByProjectId: () => ({}), archivedCyclesSearchQuery: "" },
    moduleFilter: {
      getArchivedFiltersByProjectId: () => ({}),
      getDisplayFiltersByProjectId: () => ({ order_by: "sort_order" }),
      archivedModulesSearchQuery: "",
    },
  }) as unknown as CoreRootStore;

for (const kind of ["cycle", "module"] as const) {
  const setup = () => {
    const store = kind === "cycle" ? new CycleStore(root()) : new ModulesStore(root());
    const get =
      store instanceof CycleStore
        ? vi.spyOn(store.cycleArchiveService, "getArchivedCycles")
        : vi.spyOn(store.moduleArchiveService, "getArchivedModules");
    const fetch = () =>
      store instanceof CycleStore
        ? store.fetchArchivedCycles("workspace", "project")
        : store.fetchArchivedModules("workspace", "project");
    const ids = () =>
      store instanceof CycleStore ? store.currentProjectArchivedCycleIds : store.projectArchivedModuleIds;
    const filteredIds = () =>
      store instanceof CycleStore
        ? store.getFilteredArchivedCycleIds("project")
        : store.getFilteredArchivedModuleIds("project");
    return { store, get, fetch, ids, filteredIds };
  };
  describe(`archived ${kind} loading`, () => {
    it("finishes a direct archive visit even when the regular list has never loaded", async () => {
      const { store, get, fetch, ids, filteredIds } = setup();
      get.mockResolvedValue([]);
      expect(ids()).toBeNull();
      await fetch();
      expect(ids()).toEqual([]);
      expect(filteredIds()).toEqual([]);
      expect(store.fetchedMap.project).toBeUndefined();
      expect(get).toHaveBeenCalledWith("workspace", "project");
    });
    it("does not mistake a loaded regular list for a loaded archive", () => {
      const { store, ids, filteredIds } = setup();
      runInAction(() => {
        store.fetchedMap.project = true;
      });
      expect(ids()).toBeNull();
      expect(filteredIds()).toBeNull();
    });
    it("propagates failure for the page retry and can recover", async () => {
      const { get, fetch, ids } = setup();
      get.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue([]);
      await expect(fetch()).rejects.toThrow("Offline");
      expect(ids()).toBeNull();
      await fetch();
      expect(ids()).toEqual([]);
    });
    it("reads archived records without waiting for an unrelated regular-list request", async () => {
      const { store, get, fetch, ids, filteredIds } = setup();
      get.mockResolvedValue([
        { id: "archived", project_id: "project", archived_at: "2026-10-15", name: "Archived" },
        { id: "active", project_id: "project", archived_at: null, name: "Active" },
        { id: "other", project_id: "other", archived_at: "2026-10-15", name: "Other" },
      ] as ICycle[] & IModule[]);
      runInAction(() => {
        store.loader = true;
      });
      await fetch();
      expect(ids()).toEqual(["archived"]);
      expect(filteredIds()).toEqual(["archived"]);
      expect(store.loader).toBe(true);
    });
  });
}
