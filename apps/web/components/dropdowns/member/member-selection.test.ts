import { describe, expect, it } from "vitest";
import { getEligibleMemberIds, toggleEligibleMembers } from "./member-selection";

describe("project invitation member selection", () => {
  const candidates = [
    { id: "alice", searchText: "Alice Smith", suspended: false },
    { id: "bob", searchText: "Bob Smith", suspended: false },
    { id: "suspended", searchText: "Alice Suspended", suspended: true },
  ];

  it("limits select all to the current search and excludes suspended members", () => {
    expect(getEligibleMemberIds(candidates, " ALICE ")).toEqual(["alice"]);
    expect(getEligibleMemberIds(candidates, "")).toEqual(["alice", "bob"]);
    expect(getEligibleMemberIds(candidates, "missing")).toEqual([]);
  });

  it("preserves other searches' selections and never adds duplicates", () => {
    expect(toggleEligibleMembers(["bob"], ["alice"])).toEqual(["bob", "alice"]);
    expect(toggleEligibleMembers(["alice"], ["alice", "bob"])).toEqual(["alice", "bob"]);
  });

  it("deselects only matching members and leaves empty results unchanged", () => {
    expect(toggleEligibleMembers(["alice", "bob"], ["alice"])).toEqual(["bob"]);
    expect(toggleEligibleMembers(["bob"], [])).toEqual(["bob"]);
  });
});
