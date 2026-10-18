import { autorun } from "mobx";
import { expect, it, vi } from "vitest";
import { MultipleSelectStore } from "./multiple_select.store";

vi.mock("@/services/issue", () => ({ IssueService: vi.fn() }));

it("removes all matching IDs across groups while preserving survivor order, duplicates and last selection", () => {
  const store = new MultipleSelectStore();
  const a = { entityID: "a", groupID: "one" };
  const b = { entityID: "b", groupID: "one" };
  const c = { entityID: "c", groupID: "two" };
  store.bulkUpdateSelectedEntityDetails([a, b, { ...a, groupID: "two" }, c, b], "add");
  const firstB = store.selectedEntityDetails[1];
  const last = store.lastSelectedEntityDetails;
  const seen: string[][] = [];
  const dispose = autorun(() => seen.push(store.selectedEntityIds));
  store.bulkUpdateSelectedEntityDetails([a, a, { entityID: "missing", groupID: "one" }], "remove");
  dispose();
  expect(store.selectedEntityDetails).toEqual([b, c, b]);
  expect(store.selectedEntityDetails[0]).toBe(firstB);
  expect(store.getEntityDetailsFromEntityID("b")).toBe(firstB);
  expect(store.lastSelectedEntityDetails).toBe(last);
  expect(seen).toEqual([
    ["a", "b", "a", "c", "b"],
    ["b", "c", "b"],
  ]);
  store.bulkUpdateSelectedEntityDetails([], "remove");
  expect(store.selectedEntityDetails).toEqual([b, c, b]);
  store.bulkUpdateSelectedEntityDetails([b, c], "remove");
  expect(store.selectedEntityDetails).toEqual([]);
  expect(store.getEntityDetailsFromEntityID("b")).toBeNull();
});
