import { expect, it } from "vitest";
import type { IIssueLabel } from "@plane/types";
import { getSortedLabelPayload, ROOT_LABEL_GROUP } from "./sort-label";
const label = (id: string, sort_order: number, parent: string | null = null) =>
  ({ id, sort_order, parent }) as IIssueLabel;
const entries = [label("a", 0), label("b", 100), label("c", 200), label("child-a", 0, "a"), label("child-b", 100, "a")];
const change = { id: "a", initialIndex: 0, index: 1, initialGroup: ROOT_LABEL_GROUP, group: ROOT_LABEL_GROUP };
it("calculates both directions against remaining siblings and accepts zero positions", () => {
  expect(getSortedLabelPayload(entries, change)).toEqual({ sort_order: 150 });
  expect(getSortedLabelPayload(entries, { ...change, id: "c", initialIndex: 2, index: 0 })).toEqual({
    sort_order: -10000,
  });
  expect(getSortedLabelPayload(entries, { ...change, index: 2 })).toEqual({ sort_order: 10200 });
  expect(entries.map((entry) => entry.id)).toEqual(["a", "b", "c", "child-a", "child-b"]);
});
it("sorts child labels independently without rewriting parent membership", () => {
  expect(getSortedLabelPayload(entries, { ...change, id: "child-a", initialGroup: "a", group: "a" })).toEqual({
    sort_order: 10100,
  });
});
it("rejects cross-group, stale, unchanged and out-of-bounds changes", () => {
  expect(getSortedLabelPayload(entries, { ...change, group: "a" })).toBeUndefined();
  expect(getSortedLabelPayload(entries, { ...change, initialIndex: 1 })).toBeUndefined();
  expect(getSortedLabelPayload(entries, { ...change, index: 0 })).toBeUndefined();
  expect(getSortedLabelPayload(entries, { ...change, index: 99 })).toBeUndefined();
});
