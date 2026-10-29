import { describe, expect, it } from "vitest";
import {
  getEligibleMemberIds,
  toggleEligibleMembers,
  memberDisplayName,
  reconcileSelectedMembers,
} from "./member-selection";

import en from "../../../../../packages/i18n/src/locales/en/project-settings.json";
import zh from "../../../../../packages/i18n/src/locales/zh-CN/project-settings.json";

describe("project invitation member selection", () => {
  it("provides translated selection and accessible remove labels with matching placeholders", () => {
    const english = en.project_settings.members.invite_members;
    const chinese = zh.project_settings.members.invite_members;
    expect(english.select_members).toBe("Select members");
    expect(chinese.select_members).toBe("选择成员");
    for (const labels of [english, chinese]) {
      expect(labels.selected_count).toContain("{count, plural,");
      expect(labels.selected_count).toContain("one {");
      expect(labels.selected_count).toContain("other {");
      expect(labels.remove_member).toContain("{name}");
    }
  });
  it("prefers display names and falls back to full name, email, then a localized unknown label", () => {
    expect(memberDisplayName({ display_name: "昵称", first_name: "First" }, "未知用户")).toBe("昵称");
    expect(memberDisplayName({ display_name: "  ", first_name: "Jane", last_name: "Doe" }, "未知用户")).toBe(
      "Jane Doe"
    );
    expect(memberDisplayName({ email: "jane@example.com" }, "未知用户")).toBe("jane@example.com");
    expect(memberDisplayName(null, "未知用户")).toBe("未知用户");
  });

  it("preserves edited roles when selecting across searches and removes only deselected members", () => {
    const alice = { member_id: "alice", role: 5 };
    const create = (id: string) => ({ member_id: id, role: 15 });
    expect(reconcileSelectedMembers(["bob", "alice", "bob"], [alice], create)).toEqual([
      { member_id: "bob", role: 15 },
      alice,
    ]);
    expect(reconcileSelectedMembers(["alice"], [alice, create("bob")], create)[0]).toBe(alice);
  });

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
