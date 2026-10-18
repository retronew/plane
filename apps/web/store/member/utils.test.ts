import { autorun, observable, runInAction } from "mobx";
import { expect, it } from "vitest";
import type { TProjectMembership } from "@plane/types";
import { filterProjectMembersByRole, filterWorkspaceMembersByRole } from "./utils";

it("preserves suspended membership, duplicate order and empty-filter identity", () => {
  const active = { role: "20", is_active: true };
  const suspended = { role: "20", is_active: false };
  const literal = { role: "suspended", is_active: true };
  const members = [active, suspended, literal, active];
  expect(filterWorkspaceMembersByRole(members, [])).toBe(members);
  expect(filterWorkspaceMembersByRole(members, ["suspended", "20", "20"])).toEqual([active, suspended, active]);
  expect(filterWorkspaceMembersByRole(members, ["suspended"])).toEqual([suspended]);
});

it("preserves project role fallback, duplicate members and empty-filter identity", () => {
  const members = [
    { role: 0, original_role: 20 },
    { role: null, original_role: 20 },
    { role: null, original_role: null },
  ] as unknown as TProjectMembership[];
  const input = [...members, members[1]];
  expect(filterProjectMembersByRole(input, [])).toBe(input);
  expect(filterProjectMembersByRole(input, ["20", "20"])).toEqual([members[1], members[1]]);
  expect(filterProjectMembersByRole(input, ["0", ""])).toEqual([members[0], members[2]]);
  const roles = observable(["0"]);
  const seen: number[] = [];
  const dispose = autorun(() => seen.push(filterProjectMembersByRole(input, roles).length));
  runInAction(() => roles.replace(["20"]));
  dispose();
  expect(seen).toEqual([1, 2]);
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
