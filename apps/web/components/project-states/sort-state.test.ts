import { describe, expect, it } from "vitest";
import type { IState } from "@plane/types";
import { getSortedStatePayload } from "./sort-state";
const state = (id: string, sequence: number) => ({ id, sequence }) as IState;
const groups = () => ({
  backlog: [state("a", 0), state("b", 100), state("c", 200)],
  started: [state("d", 500)],
  completed: [],
});
describe("dnd-kit state persistence", () => {
  it("inserts upward without treating zero as a missing sequence", () => {
    const data = groups();
    expect(
      getSortedStatePayload(data, { id: "c", initialGroup: "backlog", group: "backlog", initialIndex: 2, index: 0 })
    ).toEqual({ group: "backlog", sequence: -65535 });
    expect(data.backlog.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
  it("inserts downward between the final neighbors", () => {
    expect(
      getSortedStatePayload(groups(), { id: "a", initialGroup: "backlog", group: "backlog", initialIndex: 0, index: 1 })
    ).toEqual({ group: "backlog", sequence: 150 });
  });
  it("rejects cross-group drops, including empty groups", () => {
    const change = { id: "b", initialGroup: "backlog", initialIndex: 1, index: 0 };
    expect(getSortedStatePayload(groups(), { ...change, group: "started" })).toBeUndefined();
    expect(getSortedStatePayload(groups(), { ...change, group: "completed" })).toBeUndefined();
  });
  it("ignores unchanged, stale, invalid and last-state moves", () => {
    expect(
      getSortedStatePayload(groups(), { id: "a", initialGroup: "backlog", group: "backlog", initialIndex: 0, index: 0 })
    ).toBeUndefined();
    expect(
      getSortedStatePayload(groups(), { id: "a", initialGroup: "backlog", group: "started", initialIndex: 1, index: 0 })
    ).toBeUndefined();
    expect(
      getSortedStatePayload(groups(), {
        id: "d",
        initialGroup: "started",
        group: "completed",
        initialIndex: 0,
        index: 0,
      })
    ).toBeUndefined();
    expect(
      getSortedStatePayload(groups(), { id: "a", initialGroup: "backlog", group: "missing", initialIndex: 0, index: 0 })
    ).toBeUndefined();
  });
});
