import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { SpreadsheetCreatedByColumn } from "./created-by-column";
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => (id === "creator" ? { id, display_name: "创建成员", avatar_url: "" } : undefined),
  }),
}));
vi.mock("@/components/dropdowns/member/avatar", () => ({
  ButtonAvatars: ({ userIds }: { userIds: string }) => <span data-testid="avatar">{userIds}</span>,
}));
beforeEach(async () => {
  await setLanguage("zh-CN");
});
it("renders the actual creator and avatar without an editable member selector", () => {
  render(<SpreadsheetCreatedByColumn issue={{ created_by: "creator" } as TIssue} />);
  expect(screen.getByText("创建成员")).toBeTruthy();
  expect(screen.getByTestId("avatar").textContent).toBe("creator");
  expect(screen.queryByRole("button")).toBeNull();
});
it("handles an unavailable creator without a blank avatar", () => {
  render(<SpreadsheetCreatedByColumn issue={{ created_by: "missing" } as TIssue} />);
  expect(screen.getByText("无")).toBeTruthy();
  expect(screen.queryByTestId("avatar")).toBeNull();
});
