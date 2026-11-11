import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssueServiceType } from "@plane/types";
import type { TSubIssueOperations } from "@plane/types";
import { SubIssuesListItem } from "./list-item";

const state = vi.hoisted(() => ({
  visibleChildren: ["grandchild"] as string[],
  getVisible: vi.fn(),
  getFilters: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    issue: {
      getIssueById: () => ({
        id: "child",
        name: "Child title",
        project_id: "project",
        parent_id: "root",
        sub_issues_count: 1,
        sequence_id: 1,
      }),
    },
    subIssues: {
      filters: { getSubIssueFilters: state.getFilters, getVisibleSubWorkItemIds: state.getVisible },
    },
    toggleCreateIssueModal: vi.fn(),
    toggleDeleteIssueModal: vi.fn(),
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ id: "project", identifier: "TEST" }) }),
}));
vi.mock("@/hooks/use-issue-peek-overview-redirection", () => ({
  default: () => ({ handleRedirection: state.redirect }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({ PrioritySelect: () => null }));
vi.mock("./properties", () => ({ SubIssuesListItemProperties: () => null }));
vi.mock("./root", () => ({
  SubIssuesListRoot: ({ parentIssueId, issueServiceType }: { parentIssueId: string; issueServiceType: string }) => (
    <div data-testid="descendant-tree" data-parent={parentIssueId} data-service={issueServiceType} />
  ),
}));
vi.mock("@plane/blocks/layout", () => ({
  ControlLink: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <a
      href="/child"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </a>
  ),
}));
const props = {
  workspaceSlug: "workspace",
  projectId: "project",
  parentIssueId: "root",
  rootIssueId: "root",
  issueId: "child",
  treeBranches: [],
  canEdit: true,
  handleIssueCrudState: vi.fn(),
  subIssueOperations: {} as TSubIssueOperations,
  issueServiceType: EIssueServiceType.ISSUES,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.visibleChildren = ["grandchild"];
  state.getVisible.mockImplementation(() => state.visibleChildren);
  state.getFilters.mockReturnValue({ displayProperties: {} });
});
it("renders visible descendants automatically without a per-row expand control", () => {
  render(<SubIssuesListItem {...props} />);
  expect(screen.getByText("Child title")).toBeTruthy();
  expect(screen.getByTestId("descendant-tree").getAttribute("data-parent")).toBe("child");
  expect(screen.getByTestId("descendant-tree").getAttribute("data-service")).toBe(EIssueServiceType.ISSUES);
  expect(screen.queryByRole("button", { name: "web.toggle_sub_issues" })).toBeNull();
  expect(state.getVisible).toHaveBeenCalledWith("child", "root");
});
it("hides descendants when the tree visibility selector returns no children", () => {
  state.visibleChildren = [];
  render(<SubIssuesListItem {...props} />);
  expect(screen.getByText("Child title")).toBeTruthy();
  expect(screen.queryByTestId("descendant-tree")).toBeNull();
});
it("opens the child when clicking its identifier without an embedded disabled button", () => {
  state.getFilters.mockReturnValue({ displayProperties: { key: true } });
  render(<SubIssuesListItem {...props} />);
  const identifier = screen.getByText("TEST-1");
  expect(identifier.tagName).toBe("SPAN");
  expect(identifier.closest("button")).toBeNull();
  fireEvent.click(identifier);
  expect(state.redirect).toHaveBeenCalledWith("workspace", expect.objectContaining({ id: "child" }), false);
});

it("uses the root display properties for nested rows", () => {
  render(<SubIssuesListItem {...props} parentIssueId="intermediate" />);
  expect(state.getFilters).toHaveBeenCalledWith("root");
  expect(state.getFilters).not.toHaveBeenCalledWith("intermediate");
});
