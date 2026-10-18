import { beforeEach, expect, it, vi } from "vitest";
import { runInAction } from "mobx";
import type { TLink } from "@plane/types";
import { WorkspaceLinkStore } from "./link.store";

vi.mock("@/services/workspace.service", () => ({ WorkspaceService: vi.fn() }));
let store: WorkspaceLinkStore;
const update = vi.fn();
const makeLink = (id: string, sort_order?: number) => ({ id, sort_order, title: id, workspace_slug: "w" }) as TLink;
beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
  store = new WorkspaceLinkStore();
  store.workspaceService = { updateWorkspaceLink: update } as never;
  store.addLinks("w", [makeLink("a", 0), makeLink("b", 10000), makeLink("c", 20000), makeLink("d", 30000)]);
});

it.each([
  ["a", 2, ["b", "c", "a", "d"], 25000],
  ["d", 1, ["a", "d", "b", "c"], 5000],
  ["d", 0, ["d", "a", "b", "c"], -10000],
  ["a", 3, ["b", "c", "d", "a"], 40000],
])("moves %s to final index %i using the remaining neighbors", async (id, index, ids, order) => {
  await store.reorderLink("w", id, index);
  expect(store.links.w).toEqual(ids);
  expect(store.linkMap[id].sort_order).toBe(order);
  expect(update).toHaveBeenCalledWith("w", id, { sort_order: order });
  expect(store.isReorderingLinks.w).toBe(false);
});

it("optimistically updates both values, blocks another reorder and rolls back a failed request", async () => {
  let reject!: (error: Error) => void;
  update.mockImplementationOnce(
    () =>
      new Promise((_resolve, rejectRequest) => {
        reject = rejectRequest;
      })
  );
  const pending = store.reorderLink("w", "a", 2);
  expect(store.links.w).toEqual(["b", "c", "a", "d"]);
  expect(store.linkMap.a.sort_order).toBe(25000);
  expect(store.isReorderingLinks.w).toBe(true);
  await expect(store.reorderLink("w", "b", 3)).rejects.toThrow("already being saved");
  expect(update).toHaveBeenCalledOnce();
  reject(new Error("offline"));
  await expect(pending).rejects.toThrow("offline");
  expect(store.links.w).toEqual(["a", "b", "c", "d"]);
  expect(store.linkMap.a.sort_order).toBe(0);
  expect(store.isReorderingLinks.w).toBe(false);
});

it("preserves concurrent additions and deletions when rolling back", async () => {
  let reject!: (error: Error) => void;
  update.mockImplementationOnce(
    () =>
      new Promise((_resolve, rejectRequest) => {
        reject = rejectRequest;
      })
  );
  const pending = store.reorderLink("w", "b", 3);
  runInAction(() => {
    store.links.w = ["new", "a", "d", "b"];
    store.linkMap.new = makeLink("new", -10000);
    delete store.linkMap.c;
  });
  reject(new Error("offline"));
  await expect(pending).rejects.toThrow("offline");
  expect(store.links.w).toEqual(["new", "a", "b", "d"]);
  expect(store.linkMap.b.sort_order).toBe(10000);
  expect(store.linkMap.c).toBeUndefined();
});

it("does not restore a link deleted while saving", async () => {
  let reject!: (error: Error) => void;
  update.mockImplementationOnce(
    () =>
      new Promise((_resolve, rejectRequest) => {
        reject = rejectRequest;
      })
  );
  const pending = store.reorderLink("w", "a", 3);
  runInAction(() => {
    store.links.w = ["b", "c", "d"];
    delete store.linkMap.a;
  });
  reject(new Error("offline"));
  await expect(pending).rejects.toThrow("offline");
  expect(store.links.w).toEqual(["b", "c", "d"]);
  expect(store.linkMap.a).toBeUndefined();
});

it("ignores invalid inputs and no-op moves without issuing requests", async () => {
  await Promise.all([NaN, Infinity, -1, 4, 0.5].map((index) => store.reorderLink("w", "a", index)));
  await store.reorderLink("w", "a", 0);
  await store.reorderLink("other", "a", 1);
  await store.reorderLink("w", "missing", 1);
  expect(update).not.toHaveBeenCalled();
  expect(store.links.w).toEqual(["a", "b", "c", "d"]);
});

it("falls back to API order for missing or non-finite sort orders", async () => {
  store.addLinks("w", [makeLink("a"), makeLink("b", NaN), makeLink("c", Infinity)]);
  expect(store.links.w).toEqual(["a", "b", "c"]);
  expect(store.linkMap.b.sort_order).toBe(10000);
  await store.reorderLink("w", "c", 1);
  expect(update).toHaveBeenCalledWith("w", "c", { sort_order: 5000 });
});

it("rejects a move when no representable value fits between neighbors", async () => {
  store.addLinks("w", [makeLink("a", 1), makeLink("b", 1), makeLink("c", 2)]);
  await expect(store.reorderLink("w", "c", 1)).rejects.toThrow("finite");
  expect(store.links.w).toEqual(["a", "b", "c"]);
  expect(update).not.toHaveBeenCalled();
});
