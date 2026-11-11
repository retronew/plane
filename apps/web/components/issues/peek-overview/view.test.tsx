import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TIssueOperations } from "../issue-detail";
import { IssueView } from "./view";

const mocks = vi.hoisted(() => ({ mounts: vi.fn(), unmounts: vi.fn() }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    setPeekIssue: vi.fn(),
    isAnyModalOpen: false,
    issue: { getIssueById: (id: string) => ({ id, project_id: "project" }) },
  }),
}));
vi.mock("@/hooks/use-keypress", () => ({ default: () => {} }));
vi.mock("@/hooks/use-peek-overview-outside-click", () => ({ default: () => {} }));
vi.mock("./use-peek-mode", () => ({ usePeekMode: () => ({ mode: "side-peek", setMode: vi.fn() }) }));
vi.mock("./use-peek-animation", () => ({ usePeekAnimation: () => {} }));
vi.mock("./header", () => ({
  IssuePeekOverviewHeader: function Header({ issueId }: { issueId: string }) {
    useEffect(() => {
      mocks.mounts();
      return () => {
        mocks.unmounts();
      };
    }, []);
    return <button data-testid="peek-toolbar">{issueId}</button>;
  },
}));
vi.mock("./loader", () => ({
  IssuePeekOverviewLoader: ({ showHeader }: { showHeader: boolean }) => (
    <div data-testid="body-skeleton">{showHeader && <button>Skeleton close</button>}</div>
  ),
}));
vi.mock("./error", () => ({ IssuePeekOverviewError: () => null }));
vi.mock("./issue-detail", () => ({ PeekOverviewIssueDetails: () => <div>Issue body</div> }));
vi.mock("./properties", () => ({ PeekOverviewProperties: () => null }));
vi.mock("../issue-detail/issue-activity", () => ({ IssueActivity: () => null }));
vi.mock("../issue-detail-widgets", () => ({ IssueDetailWidgets: () => null }));
const props = {
  workspaceSlug: "workspace",
  projectId: "project",
  issueId: "parent",
  is_archived: false,
  issueOperations: {} as TIssueOperations,
};
beforeEach(() => vi.clearAllMocks());
it("keeps the same toolbar mounted while a child loads and after returning", () => {
  const { rerender } = render(<IssueView {...props} />);
  const toolbar = screen.getByTestId("peek-toolbar");
  rerender(<IssueView {...props} issueId="child" isLoading />);
  expect(screen.getByTestId("peek-toolbar")).toBe(toolbar);
  expect(toolbar.textContent).toBe("child");
  expect(screen.getByTestId("body-skeleton")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Skeleton close" })).toBeNull();
  rerender(<IssueView {...props} issueId="child" />);
  expect(screen.getByTestId("peek-toolbar")).toBe(toolbar);
  rerender(<IssueView {...props} isLoading />);
  expect(screen.getByTestId("peek-toolbar")).toBe(toolbar);
  expect(mocks.mounts).toHaveBeenCalledTimes(1);
  expect(mocks.unmounts).not.toHaveBeenCalled();
});
