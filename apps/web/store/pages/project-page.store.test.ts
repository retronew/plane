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
