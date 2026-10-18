import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { E_SORT_ORDER, defaultActivityFilters } from "@plane/constants";
import type { TCommentsOperations } from "@plane/types";
import { IssueActivityCommentRoot } from "./activity-comment-root";
import { IntakeActivityTabs } from "./intake-tabs";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/comments/card/root", () => ({
  CommentCard: ({ comment, isIntakeIssue }: { comment: { id: string }; isIntakeIssue: boolean }) => (
    <div data-testid="comment" data-intake={isIntakeIssue}>
      {comment.id}
    </div>
  ),
}));
vi.mock("./activity/activity-list", () => ({
  IssueActivityItem: ({ activityId }: { activityId: string }) => <div>{activityId}</div>,
}));
vi.mock("./loader", () => ({ IssueActivityLoader: () => <div>loading</div> }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/store/use-project-state", () => ({ useProjectState: () => ({ getStateById: () => undefined }) }));
const items = [
  { id: "created", activity_type: "DEFAULT" },
  { id: "comment", activity_type: "COMMENT" },
  { id: "transition", activity_type: "STATE" },
  { id: "rename", activity_type: "ACTIVITY" },
];
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    activity: {
      getActivityAndCommentsByIssueId: () => items,
      getActivityById: (id: string) => ({
        field: id === "transition" ? "state" : id === "created" ? null : "name",
        old_value: id === "rename" ? "old" : null,
        new_value: id === "rename" ? "new" : null,
      }),
    },
    comment: { getCommentById: (id: string) => ({ id }) },
  }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.getAnimations ??= () => [];
});
const props = {
  workspaceSlug: "workspace",
  projectId: "project",
  issueId: "issue",
  isIntakeIssue: true,
  selectedFilters: defaultActivityFilters,
  activityOperations: {} as TCommentsOperations,
  sortOrder: E_SORT_ORDER.DESC,
};
it("renders the five real tabs in reference order and selects a tab", () => {
  const change = vi.fn();
  render(<IntakeActivityTabs value="all" onChange={change} />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs.map((tab) => tab.textContent)).toEqual([
    "common.all",
    "common.activity",
    "common.comments",
    "web.runtime.intake_activity_transitions",
    "history",
  ]);
  fireEvent.click(tabs[2]);
  expect(change).toHaveBeenCalledWith("comments");
});
it("comments excludes default creation events and passes the intake card variant", () => {
  render(<IssueActivityCommentRoot {...props} intakeTab="comments" />);
  expect(screen.getByTestId("comment").getAttribute("data-intake")).toBe("true");
  expect(screen.queryByText("created")).toBeNull();
  expect(screen.queryByText("transition")).toBeNull();
});
it("activity excludes comments but retains creation and updates", () => {
  render(<IssueActivityCommentRoot {...props} intakeTab="activity" />);
  expect(screen.getByText("created")).toBeTruthy();
  expect(screen.getByText("rename")).toBeTruthy();
  expect(screen.queryByTestId("comment")).toBeNull();
});
it("transitions only includes state changes", () => {
  render(<IssueActivityCommentRoot {...props} intakeTab="transitions" />);
  expect(screen.getByText("transition")).toBeTruthy();
  expect(screen.queryByText("created")).toBeNull();
  expect(screen.queryByText("rename")).toBeNull();
});
it("history includes records with old/new values", () => {
  render(<IssueActivityCommentRoot {...props} intakeTab="history" />);
  expect(screen.getByText("rename")).toBeTruthy();
  expect(screen.queryByText("created")).toBeNull();
});
it.each(["comments", "transitions", "history"] as const)(
  "filters normal notification tabs by %s without switching comment business mode",
  (intakeTab) => {
    render(<IssueActivityCommentRoot {...props} isIntakeIssue={false} variant="tabs" intakeTab={intakeTab} />);
    if (intakeTab === "comments") {
      expect(screen.getByTestId("comment").getAttribute("data-intake")).toBe("false");
      expect(screen.queryByText("created")).toBeNull();
    } else {
      expect(screen.queryByTestId("comment")).toBeNull();
      expect(screen.getByText(intakeTab === "transitions" ? "transition" : "rename")).toBeTruthy();
      expect(screen.queryByText("created")).toBeNull();
    }
  }
);
it("preserves normal work item filtering regardless of intake tab", () => {
  render(<IssueActivityCommentRoot {...props} isIntakeIssue={false} intakeTab="comments" />);
  expect(screen.getByText("created")).toBeTruthy();
  expect(screen.getByText("rename")).toBeTruthy();
  expect(screen.getByTestId("comment")).toBeTruthy();
});
