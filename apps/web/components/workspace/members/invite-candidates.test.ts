import { describe, expect, it } from "vitest";
import { filterInviteCandidates, getInviteCandidateName } from "./invite-candidates";
import type { TWorkspaceInviteCandidate } from "@/services/workspace.service";

const users: TWorkspaceInviteCandidate[] = [
  {
    id: "1",
    first_name: "吴",
    last_name: "佐",
    display_name: "wuzuo",
    email: "wu@example.com",
    avatar_url: null,
    invitation_status: "available",
  },
  {
    id: "2",
    first_name: "",
    last_name: "",
    display_name: "Alice",
    email: "alice@example.com",
    avatar_url: null,
    invitation_status: "available",
  },
];

describe("workspace invitation candidates", () => {
  it("searches names, display names and email without case or surrounding whitespace", () => {
    expect(filterInviteCandidates(users, " ALICE@EXAMPLE ")).toEqual([users[1]]);
    expect(filterInviteCandidates(users, "吴 佐")).toEqual([users[0]]);
    expect(filterInviteCandidates(users, "wuzuo")).toEqual([users[0]]);
    expect(filterInviteCandidates(users, "missing")).toEqual([]);
    expect(filterInviteCandidates(users, "  ")).toEqual(users);
  });

  it("falls back to display name and then email for users without full names", () => {
    expect(getInviteCandidateName(users[0])).toBe("吴 佐");
    expect(getInviteCandidateName(users[1])).toBe("Alice");
    expect(getInviteCandidateName({ ...users[1], display_name: "" })).toBe("alice@example.com");
  });
});
