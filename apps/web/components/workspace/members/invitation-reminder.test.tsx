import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ data: [] as { id: string }[] | undefined }));
vi.mock("@/hooks/use-workspace-invitations", () => ({ useWorkspaceInvitations: () => state }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (_key: string, values: { count: number }) => `您有 ${values.count} 条工作区邀请 · 查看`,
  }),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@makeplane/propel/icons", () => ({ MailsOutline: () => <svg /> }));
import { InvitationReminder } from "./invitation-reminder";

describe("InvitationReminder", () => {
  it("hides when invitations are loading or empty", () => {
    state.data = undefined;
    const { rerender } = render(<InvitationReminder />);
    expect(screen.queryByRole("link")).toBeNull();
    state.data = [];
    rerender(<InvitationReminder />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows pending count, links to invitations and disappears after acceptance", () => {
    state.data = [{ id: "one" }, { id: "two" }];
    const { rerender } = render(<InvitationReminder />);
    expect(screen.getByRole("link", { name: "您有 2 条工作区邀请 · 查看" }).getAttribute("href")).toBe("/invitations");
    state.data = [];
    rerender(<InvitationReminder />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
