import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import type { TNameDescriptionLoader } from "@plane/types";
import { beforeEach, expect, it, vi } from "vitest";
import type { TIssueOperations } from "../issue-detail";
import { IssueView } from "./view";

const mocks = vi.hoisted(() => ({
  mounts: vi.fn(),
  unmounts: vi.fn(),
  editors: new Map<string, (value: TNameDescriptionLoader) => void>(),
  unmountEditor: vi.fn(),
}));
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
vi.mock("./issue-detail", () => ({
  PeekOverviewIssueDetails: function Editor({
    issueId,
    isSubmitting,
    setIsSubmitting,
  }: {
    issueId: string;
    isSubmitting: TNameDescriptionLoader;
    setIsSubmitting: (value: TNameDescriptionLoader) => void;
  }) {
    useEffect(() => {
      mocks.editors.set(issueId, setIsSubmitting);
    }, [issueId, setIsSubmitting]);
    useEffect(
      () => () => {
        mocks.unmountEditor();
      },
      []
    );
    return <div data-testid="save-status">{isSubmitting}</div>;
  },
}));
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
beforeEach(() => {
  vi.clearAllMocks();
  mocks.editors.clear();
});
it("switches cached issues in the same panel and isolates editor cleanup and late autosaves", () => {
  const { container, rerender } = render(<IssueView {...props} />);
  const panel = container.querySelector("[data-peek-panel]");
  const saveFirst = mocks.editors.get("parent")!;
  act(() => saveFirst("submitting"));
  rerender(<IssueView {...props} issueId="second" />);
  expect(panel).toBeTruthy();
  expect(container.querySelector("[data-peek-panel]")).toBe(panel);
  expect(mocks.unmountEditor).toHaveBeenCalledOnce();
  expect(screen.getByTestId("save-status").textContent).toBe("saved");
  act(() => mocks.editors.get("second")!("submitting"));
  act(() => saveFirst("saved"));
  expect(screen.getByTestId("save-status").textContent).toBe("submitting");
});
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
