import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { E_SORT_ORDER } from "@plane/constants";
import { IssueActivity } from "./root";

const storage = vi.hoisted(() => vi.fn());
vi.mock("@plane/hooks", () => ({
  useLocalStorage: (key: string, fallback: unknown) => {
    storage(key, fallback);
    return { storedValue: fallback, setValue: vi.fn() };
  },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => ({ anchor: true }) }) }));
vi.mock("./helper", () => ({ useWorkItemCommentOperations: () => ({}) }));
vi.mock("./intake-tabs", () => ({
  IntakeActivityTabs: ({ onChange }: { onChange: (value: string) => void }) => (
    <div>
      <button onClick={() => onChange("history")}>history</button>
      <button onClick={() => onChange("comments")}>comments</button>
    </div>
  ),
}));
vi.mock("./sort-root", () => ({ ActivitySortRoot: () => null }));
vi.mock("./filter-root", () => ({ ActivityFilterRoot: () => <div>filters</div> }));
vi.mock("./activity-comment-root", () => ({
  IssueActivityCommentRoot: ({
    isIntakeIssue,
    sortOrder,
    variant,
  }: {
    isIntakeIssue: boolean;
    sortOrder: string;
    variant: string;
  }) => <div data-testid="activities" data-intake={isIntakeIssue} data-order={sortOrder} data-variant={variant} />,
}));
vi.mock("@/components/comments/comment-create", () => ({
  CommentCreate: ({ isIntakeIssue, variant }: { isIntakeIssue: boolean; variant: string }) => (
    <div data-testid="composer" data-intake={isIntakeIssue} data-variant={variant} />
  ),
}));
const props = { workspaceSlug: "workspace", projectId: "project", issueId: "issue" };
beforeEach(() => storage.mockClear());

it("uses normal sort preferences and comment permissions in notification tabs", () => {
  render(<IssueActivity {...props} variant="tabs" />);
  expect(storage).toHaveBeenCalledWith("activity_sort_order", E_SORT_ORDER.ASC);
  const activities = screen.getByTestId("activities");
  const composer = screen.getByTestId("composer");
  expect(activities.getAttribute("data-intake")).toBe("false");
  expect(activities.getAttribute("data-order")).toBe(E_SORT_ORDER.ASC);
  expect(composer.getAttribute("data-intake")).toBe("false");
  expect(activities.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByText("history"));
  expect(screen.queryByTestId("composer")).toBeNull();
  fireEvent.click(screen.getByText("comments"));
  expect(screen.getByTestId("composer")).toBeTruthy();
});

it("does not enable comments for disabled notification details", () => {
  render(<IssueActivity {...props} variant="tabs" disabled />);
  fireEvent.click(screen.getByText("comments"));
  expect(screen.queryByTestId("composer")).toBeNull();
});

it("uses the shared Intake tabs and compact composer for regular issue details by default", () => {
  render(<IssueActivity {...props} />);
  expect(screen.queryByText("common.activity")).toBeNull();
  expect(screen.queryByText("filters")).toBeNull();
  expect(screen.getByTestId("activities").getAttribute("data-variant")).toBe("tabs");
  expect(screen.getByTestId("activities").getAttribute("data-intake")).toBe("false");
  expect(screen.getByTestId("composer").getAttribute("data-variant")).toBe("compact");
  expect(screen.getByTestId("composer").getAttribute("data-intake")).toBe("false");
  fireEvent.click(screen.getByText("history"));
  expect(screen.queryByTestId("composer")).toBeNull();
  fireEvent.click(screen.getByText("comments"));
  expect(screen.getByTestId("composer")).toBeTruthy();
});

it("retains legacy controls when explicitly requested", () => {
  render(<IssueActivity {...props} variant="default" />);
  expect(screen.getByText("common.activity")).toBeTruthy();
  expect(screen.getByText("filters")).toBeTruthy();
});

it("keeps archived regular issue details read-only with the default tabs", () => {
  render(<IssueActivity {...props} disabled />);
  expect(screen.queryByTestId("composer")).toBeNull();
  fireEvent.click(screen.getByText("comments"));
  expect(screen.queryByTestId("composer")).toBeNull();
});

it("keeps the Intake composer below descending activities", () => {
  render(<IssueActivity {...props} isIntakeIssue />);
  expect(storage).toHaveBeenCalledWith("intake_activity_sort_order", E_SORT_ORDER.DESC);
  const activities = screen.getByTestId("activities");
  const composer = screen.getByTestId("composer");
  expect(activities.getAttribute("data-order")).toBe(E_SORT_ORDER.DESC);
  expect(composer.getAttribute("data-intake")).toBe("true");
  expect(activities.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByText("comments"));
  expect(
    screen.getByTestId("activities").compareDocumentPosition(screen.getByTestId("composer")) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});
