import { autorun, runInAction } from "mobx";
import { beforeEach, expect, it, vi } from "vitest";
import type { IFavorite } from "@plane/types";
import type { CoreRootStore } from "./root.store";
import { FavoriteStore } from "./favorite.store";

const { getGroupedFavorites, updateFavorite } = vi.hoisted(() => ({
  getGroupedFavorites: vi.fn(),
  updateFavorite: vi.fn(),
}));
vi.mock("@/services/favorite", () => ({
  FavoriteService: class {
    getGroupedFavorites = getGroupedFavorites;
    updateFavorite = updateFavorite;
  },
}));
beforeEach(() => vi.resetAllMocks());
const favorite = (id: string, overrides: Partial<IFavorite> = {}): IFavorite => ({
  id,
  name: id,
  entity_type: "project",
  entity_data: { name: id, logo_props: undefined },
  is_folder: false,
  sort_order: 0,
  parent: null,
  children: [],
  project_id: null,
  sequence: 0,
  workspace_id: "workspace",
  ...overrides,
});
const makeStore = () =>
  new FavoriteStore({
    workspaceRoot: { currentWorkspace: { id: "workspace" } },
    projectRoot: { project: {} },
  } as unknown as CoreRootStore);

it("groups in insertion order and preserves existing duplicate children and their first match", () => {
  const store = makeStore();
  runInAction(() => {
    store.favoriteMap = {
      folder: favorite("folder", { children: [favorite("a", { name: "existing" }), favorite("a")] }),
      b: favorite("b", { parent: "folder" }),
      a: favorite("a", { parent: "folder", name: "incoming" }),
      other: favorite("other", { workspace_id: "other", parent: "folder" }),
      orphan: favorite("orphan", { parent: "missing" }),
    };
  });
  const grouped = store.groupedFavorites;
  expect(Object.keys(grouped)).toEqual(["folder", "b", "a", "orphan"]);
  expect(grouped.folder.children.map(({ id }) => id)).toEqual(["a", "a", "b"]);
  expect(grouped.folder.children[0].name).toBe("existing");
  grouped.folder.children[0].entity_data.name = "detached";
  expect(store.favoriteMap.folder.children[0].entity_data.name).toBe("a");
  expect(grouped.a.entity_data).toHaveProperty("logo_props", undefined);
  expect(store.favoriteMap.folder.children).toHaveLength(2);
});

it("tracks in-place observable changes to nested entities and children", () => {
  const store = makeStore();
  runInAction(() => {
    store.favoriteMap.folder = favorite("folder");
    store.favoriteMap.a = favorite("a", { parent: "folder" });
  });
  const seen: string[][] = [];
  const dispose = autorun(() => {
    seen.push(store.groupedFavorites.folder.children.map((child) => child.entity_data.name));
  });
  runInAction(() => {
    store.favoriteMap.a.entity_data.name = "updated";
  });
  runInAction(() => {
    store.favoriteMap.folder.children.push(favorite("b"));
  });
  dispose();
  expect(seen).toEqual([["a"], ["updated"], ["b", "updated"]]);
});

it("deduplicates batch IDs once in first-seen order and keeps the last response data", async () => {
  const store = makeStore();
  runInAction(() => {
    store.favoriteIds = ["old", "old", "a"];
  });
  getGroupedFavorites.mockResolvedValue([
    favorite("b"),
    favorite("a"),
    favorite("b", { name: "last", entity_identifier: "entity" }),
  ]);
  await store.fetchGroupedFavorites("workspace", "folder");
  expect(store.favoriteIds).toEqual(["old", "a", "b"]);
  expect(store.favoriteMap.b.name).toBe("last");
  expect(store.entityMap.entity.name).toBe("last");
});

it("leaves IDs untouched for empty responses and rejected batch requests", async () => {
  const store = makeStore();
  runInAction(() => {
    store.favoriteIds = ["a", "a"];
  });
  const ids = store.favoriteIds;
  getGroupedFavorites.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline"));
  await store.fetchGroupedFavorites("workspace", "folder");
  expect(store.favoriteIds).toBe(ids);
  await expect(store.fetchGroupedFavorites("workspace", "folder")).rejects.toThrow("offline");
  expect(store.favoriteIds).toBe(ids);
  expect(store.favoriteMap).toEqual({});
});

it("restores grouped data after an optimistic update fails", async () => {
  const store = makeStore();
  runInAction(() => {
    store.favoriteMap.folder = favorite("folder");
    store.favoriteMap.a = favorite("a", { parent: "folder" });
  });
  updateFavorite.mockRejectedValue(new Error("offline"));
  await expect(store.updateFavorite("workspace", "a", { name: "temporary", parent: null })).rejects.toThrow("offline");
  expect(store.groupedFavorites.folder.children.map(({ name }) => name)).toEqual(["a"]);
});
