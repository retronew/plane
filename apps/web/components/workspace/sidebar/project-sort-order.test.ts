import { describe, expect, it } from "vitest";
import { getSidebarProjectSortOrder } from "./project-sort-order";

const group = "sidebar-projects:workspace:main";
const projects = ["a", "b", "c", "d", "e"].map((id, index) => ({ id, sort_order: index * 10000 }));
const change = (id: string, initialIndex: number, index: number) => ({
  id,
  initialIndex,
  index,
  group,
  initialGroup: group,
});

describe("sidebar project ordering", () => {
  it("moves downward after the destination without averaging against the dragged project", () => {
    expect(getSidebarProjectSortOrder(change("a", 0, 2), ["a", "b", "c"], projects, group)).toBe(25000);
  });
  it("moves upward before the destination and accepts a zero sort order", () => {
    expect(getSidebarProjectSortOrder(change("c", 2, 0), ["a", "b", "c"], projects, group)).toBe(-10000);
    expect(getSidebarProjectSortOrder(change("c", 2, 1), ["a", "b", "c"], projects, group)).toBe(5000);
  });
  it("keeps the limited list's last destination ahead of hidden projects", () => {
    const order = getSidebarProjectSortOrder(change("a", 0, 1), ["a", "b"], projects, group);
    expect(order).toBe(15000);
  });
  it("places search results next to the visible target while retaining hidden relative order", () => {
    expect(getSidebarProjectSortOrder(change("a", 0, 1), ["a", "d"], projects, group)).toBe(35000);
    expect(getSidebarProjectSortOrder(change("e", 1, 0), ["b", "e"], projects, group)).toBe(5000);
  });
  it("rejects unchanged, stale, out of range and cross-workspace/group operations", () => {
    for (const operation of [
      change("a", 0, 0),
      change("b", 0, 1),
      change("a", 0, 5),
      { ...change("a", 0, 1), initialGroup: "sidebar-projects:other:main" },
      { ...change("a", 0, 1), group: "sidebar-projects:workspace:extended" },
    ])
      expect(getSidebarProjectSortOrder(operation, ["a", "b"], projects, group)).toBeUndefined();
  });
  it("does not persist an unjoined project or invalid numeric interval", () => {
    expect(
      getSidebarProjectSortOrder(
        change("a", 0, 1),
        ["a", "b"],
        [{ id: "a", sort_order: null }, ...projects.slice(1)],
        group
      )
    ).toBeUndefined();
    expect(
      getSidebarProjectSortOrder(
        change("a", 0, 1),
        ["a", "b", "c"],
        projects.map((p) => ({ id: p.id, sort_order: 0 })),
        group
      )
    ).toBeUndefined();
  });
});
