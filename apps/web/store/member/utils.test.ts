import { autorun, observable, runInAction } from "mobx";
import { expect, it } from "vitest";
import { filterWorkspaceMembersByRole } from "./utils";

it("preserves suspended membership, duplicate order and empty-filter identity", () => {
  const active = { role: "20", is_active: true };
  const suspended = { role: "20", is_active: false };
  const literal = { role: "suspended", is_active: true };
  const members = [active, suspended, literal, active];
  expect(filterWorkspaceMembersByRole(members, [])).toBe(members);
  expect(filterWorkspaceMembersByRole(members, ["suspended", "20", "20"])).toEqual([active, suspended, active]);
  expect(filterWorkspaceMembersByRole(members, ["suspended"])).toEqual([suspended]);
});

it("tracks observable role-filter changes after hoisting invariant work", () => {
  const filters = observable(["20"]);
  const members = [{ role: "20" }, { role: "20", is_active: false }];
  const seen: number[] = [];
  const dispose = autorun(() => seen.push(filterWorkspaceMembersByRole(members, filters).length));
  runInAction(() => filters.push("suspended"));
  dispose();
  expect(seen).toEqual([1, 2]);
});
