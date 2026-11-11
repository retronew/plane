import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ALL_ISSUES } from "@plane/constants";
import type { IGroupByColumn, TSubIssueOperations } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { SubIssuesListGroup } from "./list-group";

vi.mock("./list-item", () => ({
  SubIssuesListItem: ({ issueId, treeBranches }: { issueId: string; treeBranches: boolean[] }) => (
    <div data-testid={issueId}>{JSON.stringify(treeBranches)}</div>
  ),
}));
const props = {
  workItemIds: ["first", "last"],
  projectId: "project",
  workspaceSlug: "workspace",
  group: { id: ALL_ISSUES } as IGroupByColumn,
  serviceType: EIssueServiceType.ISSUES,
  canEdit: true,
  treeBranches: [],
  parentIssueId: "root",
  rootIssueId: "root",
  handleIssueCrudState: vi.fn(),
  subIssueOperations: {} as TSubIssueOperations,
};
it("keeps direct children on the same starting column", () => {
  render(<SubIssuesListGroup {...props} />);
  expect(screen.getByTestId("first").textContent).toBe("[]");
  expect(screen.getByTestId("last").textContent).toBe("[]");
});
it("continues nested sibling lines and ends the last branch", () => {
  render(<SubIssuesListGroup {...props} parentIssueId="child" />);
  expect(screen.getByTestId("first").textContent).toBe("[true]");
  expect(screen.getByTestId("last").textContent).toBe("[false]");
});
it("preserves ancestor continuation through deeper descendants", () => {
  render(<SubIssuesListGroup {...props} parentIssueId="grandchild" treeBranches={[true, false]} />);
  expect(screen.getByTestId("first").textContent).toBe("[true,false,true]");
  expect(screen.getByTestId("last").textContent).toBe("[true,false,false]");
});
