import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { KanbanIssueBlocksList } from "./blocks-list";

vi.mock("./block", () => ({
  KanbanIssueBlock: ({ issueId }: { issueId: string }) => <article>{issueId}</article>,
}));

it("renders every loaded card without waiting for viewport visibility", () => {
  const issueIds = Array.from({ length: 50 }, (_, index) => `issue-${index}`);
  render(
    <KanbanIssueBlocksList
      sub_group_id="null"
      groupId="state"
      issuesMap={{}}
      issueIds={issueIds}
      displayProperties={{}}
      updateIssue={undefined}
      quickActions={() => <></>}
      canEditProperties={() => true}
      canDropOverIssue
      canDragIssuesInCurrentGrouping
    />
  );
  expect(screen.getAllByRole("article")).toHaveLength(50);
  expect(screen.getByText("issue-49")).toBeTruthy();
});
