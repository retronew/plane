import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { TCommentsOperations, TIssueComment } from "@plane/types";
import { CommentCard } from "./root";

vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("../comment-block", () => ({
  CommentBlock: ({ children }: { children: ReactNode }) => <article>{children}</article>,
}));
vi.mock("../quick-actions", () => ({
  CommentQuickActions: ({ setEditMode }: { setEditMode: () => void }) => <button onClick={setEditMode}>edit</button>,
}));
vi.mock("./display", () => ({
  CommentCardDisplay: ({
    renderQuickActions,
    isEditing,
  }: {
    renderQuickActions: () => ReactNode;
    isEditing: boolean;
  }) => (
    <div>
      {renderQuickActions()}
      <span>{isEditing ? "editing" : "display"}</span>
    </div>
  ),
}));
vi.mock("./reason-review", () => ({
  CommentReasonReview: ({ disabled }: { disabled: boolean }) => (
    <span>{disabled ? "review disabled" : "review available"}</span>
  ),
}));

const props = {
  workspaceSlug: "team",
  entityId: "issue",
  comment: { id: "comment", workspace: "workspace" } as TIssueComment,
  activityOperations: {} as TCommentsOperations,
  ends: "only" as const,
  showAccessSpecifier: false,
  showCopyLinkOption: true,
  enableReplies: true,
};

it("enables review only for ordinary project comments", () => {
  const view = render(<CommentCard {...props} />);
  expect(screen.queryByText("review available")).toBeNull();
  view.rerender(<CommentCard {...props} projectId="project" isIntakeIssue />);
  expect(screen.queryByText("review available")).toBeNull();
  view.rerender(<CommentCard {...props} projectId="project" />);
  expect(screen.getByText("review available")).toBeTruthy();
});

it("preserves comment editing while disabling review during the edit", () => {
  render(<CommentCard {...props} projectId="project" />);
  fireEvent.click(screen.getByText("edit"));
  expect(screen.getByText("editing")).toBeTruthy();
  expect(screen.getByText("review disabled")).toBeTruthy();
});
