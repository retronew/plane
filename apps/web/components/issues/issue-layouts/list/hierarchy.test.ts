import { expect, it } from "vitest";
import type { TIssueMap } from "@plane/types";
import { buildIssueHierarchy } from "./hierarchy";
const map = {
  parent: { parent_id: null },
  child: { parent_id: "parent" },
  grandchild: { parent_id: "child" },
  other: { parent_id: null },
} as unknown as TIssueMap;
it("places descendants after their parent exactly once without an expansion step", () => {
  expect(buildIssueHierarchy(["child", "other", "parent", "grandchild", "child"], map)).toEqual([
    { id: "other", level: 0, branches: [] },
    { id: "parent", level: 0, branches: [] },
    { id: "child", level: 1, branches: [false] },
    { id: "grandchild", level: 2, branches: [false, false] },
  ]);
});
it("keeps children visible when their parent is filtered out or belongs to another group", () => {
  expect(buildIssueHierarchy(["child"], map)).toEqual([{ id: "child", level: 0, branches: [] }]);
});
it("continues ancestor lines through grandchildren until the final sibling", () => {
  const siblings = { ...map, sibling: { parent_id: "parent" } } as unknown as TIssueMap;
  expect(buildIssueHierarchy(["parent", "child", "grandchild", "sibling"], siblings)).toEqual([
    { id: "parent", level: 0, branches: [] },
    { id: "child", level: 1, branches: [true] },
    { id: "grandchild", level: 2, branches: [true, false] },
    { id: "sibling", level: 1, branches: [false] },
  ]);
});
it("renders malformed cycles once rather than recursing forever", () => {
  const cyclic = { a: { parent_id: "b" }, b: { parent_id: "a" } } as unknown as TIssueMap;
  expect(buildIssueHierarchy(["a", "b"], cyclic)).toEqual([
    { id: "a", level: 0, branches: [] },
    { id: "b", level: 1, branches: [false] },
  ]);
});
