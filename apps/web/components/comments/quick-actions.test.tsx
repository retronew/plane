import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TCommentsOperations, TIssueComment } from "@plane/types";
import { CommentQuickActions } from "./quick-actions";
const removeComment = vi.fn();
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "me" } }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => {
  Element.prototype.getAnimations ??= () => [];
  vi.clearAllMocks();
});
it("puts comment deletion last, in a separate danger group", async () => {
  render(
    <CommentQuickActions
      comment={{ id: "comment", actor: "me" } as TIssueComment}
      activityOperations={{ removeComment } as unknown as TCommentsOperations}
      setEditMode={() => {}}
      showAccessSpecifier={false}
      showCopyLinkOption={false}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "common.options" }));
  const menu = await screen.findByRole("menu");
  const deletion = within(menu).getByRole("menuitem", { name: "common.actions.delete" });
  expect(deletion.previousElementSibling).toBe(within(menu).getByRole("separator"));
  expect(within(menu).getAllByRole("menuitem").at(-1)).toBe(deletion);
  expect(deletion.classList.contains("text-danger-primary")).toBe(true);
  fireEvent.click(deletion);
  expect(removeComment).toHaveBeenCalledWith("comment");
});
it("leaves no delete item or separator for another author's comment", async () => {
  render(
    <CommentQuickActions
      comment={{ id: "comment", actor: "other" } as TIssueComment}
      activityOperations={{} as TCommentsOperations}
      setEditMode={() => {}}
      showAccessSpecifier={false}
      showCopyLinkOption
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "common.options" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).queryByRole("menuitem", { name: "common.actions.delete" })).toBeNull();
  expect(within(menu).queryByRole("separator")).toBeNull();
});
