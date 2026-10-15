import { beforeEach, expect, it, vi } from "vitest";
import { observable, runInAction } from "mobx";
import type { CoreRootStore } from "../root.store";
import { ProjectFilterStore } from "./project_filter.store";
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
function setup(slug = "workspace") {
  const router = observable({ workspaceSlug: slug });
  const store = new ProjectFilterStore({ router } as CoreRootStore);
  return { store, router };
}
it("restores valid layouts and preserves them when filters are cleared", () => {
  storage.set("project-layout:workspace", "board");
  const { store } = setup();
  expect(store.currentWorkspaceDisplayFilters?.layout).toBe("board");
  store.updateDisplayFilters("workspace", { layout: "list", my_projects: true, group_by: "priority" });
  store.updateFilters("workspace", { priority: ["high"] });
  store.clearAllFilters("workspace");
  store.clearAllAppliedDisplayFilters("workspace");
  expect(store.currentWorkspaceDisplayFilters).toMatchObject({
    layout: "list",
    my_projects: false,
    group_by: "priority",
  });
  expect(storage.get("project-layout:workspace")).toBe("list");
  expect(store.currentWorkspaceFilters).toEqual({});
});
it("isolates workspaces and ignores stale layout values", () => {
  storage.set("project-layout:second", "bad");
  const { store, router } = setup();
  store.updateDisplayFilters("workspace", { layout: "timeline" });
  store.updateSearchQuery("query");
  runInAction(() => {
    router.workspaceSlug = "second";
  });
  expect(store.currentWorkspaceDisplayFilters?.layout).toBe("gallery");
  expect(store.searchQuery).toBe("");
  runInAction(() => {
    router.workspaceSlug = "workspace";
  });
  expect(store.currentWorkspaceDisplayFilters?.layout).toBe("timeline");
});
it("still works when browser storage is unavailable", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
  });
  const { store } = setup();
  store.updateDisplayFilters("workspace", { layout: "board" });
  expect(store.currentWorkspaceDisplayFilters?.layout).toBe("board");
});
