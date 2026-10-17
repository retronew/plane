import { beforeEach, expect, it, vi } from "vitest";
import type { TPage } from "@plane/types";
import type { CoreRootStore } from "../root.store";
import { ProjectPageStore } from "./project-page.store";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/services/page", () => ({
  ProjectPageService: class {
    create = mocks.create;
  },
}));
vi.mock("./project-page", () => ({
  // oxlint-disable-next-line typescript/no-extraneous-class -- mock must remain constructible
  ProjectPage: class {
    constructor(_store: unknown, page: TPage) {
      Object.assign(this, page);
    }
  },
}));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));

beforeEach(() => vi.clearAllMocks());

function makeStore() {
  return new ProjectPageStore({ router: { workspaceSlug: "workspace", projectId: "project" } } as CoreRootStore);
}

it("filters actual page-store results by any selected label together with search, favorites and creators", () => {
  const store = makeStore();
  const add = (id: string, labels: string[], favorite = true, owner = "alice") => {
    store.data[id] = {
      id,
      name: "Design notes",
      project_ids: ["project"],
      access: 0,
      archived_at: null,
      label_ids: labels,
      is_favorite: favorite,
      owned_by: owner,
      created_at: "2026-10-01T00:00:00Z",
    } as never;
  };
  add("first", ["label-1"]);
  add("second", ["label-2"]);
  add("unrelated", ["label-3"]);
  add("not-favorite", ["label-1"], false);
  add("other-owner", ["label-1"], true, "bob");
  store.updateFilters("searchQuery", "Design");
  store.updateFilters("filters", { labels: ["label-1", "label-2"], favorites: true, created_by: ["alice"] });
  expect(new Set(store.getCurrentProjectFilteredPageIdsByTab("public"))).toEqual(new Set(["first", "second"]));
  store.updateFilters("filters", { labels: [], favorites: true, created_by: ["alice"] });
  expect(new Set(store.getCurrentProjectFilteredPageIdsByTab("public"))).toEqual(
    new Set(["first", "second", "unrelated"])
  );
  store.clearAllFilters();
  expect(store.filters.searchQuery).toBe("Design");
  expect(store.getCurrentProjectFilteredPageIdsByTab("public")).toHaveLength(5);
});

it("does not publish a newly created page to the list before redirecting", async () => {
  const store = makeStore();
  const page = { id: "new-page", name: "New page" };
  mocks.create.mockResolvedValue(page);
  expect(await store.createPage({}, { addToStore: false })).toEqual(page);
  expect(mocks.create).toHaveBeenCalledWith("workspace", "project", {});
  expect(store.data[page.id]).toBeUndefined();
  expect(store.loader).toBeUndefined();
});

it("still inserts pages for callers that remain on the list", async () => {
  const store = makeStore();
  mocks.create.mockResolvedValue({ id: "new-page", name: "New page" });
  await store.createPage({});
  expect(store.data["new-page"]?.name).toBe("New page");
});

it("keeps the list unchanged when creation fails", async () => {
  const store = makeStore();
  mocks.create.mockRejectedValue(new Error("Creation failed"));
  await expect(store.createPage({}, { addToStore: false })).rejects.toThrow("Creation failed");
  expect(Object.keys(store.data)).toEqual([]);
  expect(store.loader).toBeUndefined();
});
