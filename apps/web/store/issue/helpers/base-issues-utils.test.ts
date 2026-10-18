import { autorun, observable, runInAction } from "mobx";
import { describe, expect, it, vi } from "vitest";
import type { IIssueFilterOptions, TIssue } from "@plane/types";
import { getDifference, getFilteredWorkItems } from "./base-issues-utils";

vi.mock("@/lib/store-context", () => ({ store: {} }));
vi.mock("./base-issues.store", () => ({
  EIssueGroupedAction: { ADD: "ADD", DELETE: "DELETE" },
  ISSUE_GROUP_BY_KEY: {},
}));

describe("indexed issue lookups", () => {
  it("preserves difference order, duplicates and SameValueZero equality", () => {
    const current = ["b", "b", NaN, -0] as string[];
    const previous = ["a", "a", NaN, 0] as string[];
    expect(getDifference(current, previous)).toEqual({ ADD: ["b", "b"], DELETE: ["a", "a"] });
    expect(getDifference([], [])).toEqual({ ADD: [], DELETE: [] });
  });

  it("preserves array intersection, scalar filters, order and duplicate work items", () => {
    const first = { id: "a", label_ids: ["x", "y"], priority: "high" } as TIssue;
    const other = { id: "b", label_ids: ["z"], priority: "low" } as TIssue;
    const items = [first, other, first];
    expect(getFilteredWorkItems(items, { labels: ["y", "y"], priority: ["high"] })).toEqual([first, first]);
    expect(getFilteredWorkItems(items, undefined)).toBe(items);
    expect(getFilteredWorkItems(items, {})).toBe(items);
  });

  it("retains some versus includes behavior for holes and NaN", () => {
    const filters = { labels: Array(1) } as IIssueFilterOptions;
    const item = { label_ids: [undefined] } as unknown as TIssue;
    expect(getFilteredWorkItems([item], filters)).toEqual([]);
    expect(getFilteredWorkItems([item], { labels: [undefined] } as unknown as IIssueFilterOptions)).toEqual([item]);
    const nanItem = { label_ids: [NaN] } as unknown as TIssue;
    expect(getFilteredWorkItems([nanItem], { labels: [NaN] } as unknown as IIssueFilterOptions)).toEqual([nanItem]);
  });

  it("tracks in-place observable filter and work-item changes", () => {
    const filters = observable({ labels: ["x"] });
    const items = observable([{ id: "a", label_ids: ["x"] }]) as unknown as TIssue[];
    const seen: number[] = [];
    const dispose = autorun(() => seen.push(getFilteredWorkItems(items, filters).length));
    runInAction(() => filters.labels.splice(0, 1, "y"));
    runInAction(() => items[0].label_ids.push("y"));
    dispose();
    expect(seen).toEqual([1, 0, 1]);
  });
});
