import { act, cleanup, render, screen } from "@testing-library/react";
import { makeAutoObservable, runInAction } from "mobx";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SubIssuesProgress } from "./sub-issues-progress";

const store = vi.hoisted(() => ({
  count: undefined as number | undefined,
  distribution: { backlog: ["a"], unstarted: [], started: [], completed: ["b"], cancelled: [] },
  states: {} as Record<string, string>,
  fetchSubIssues: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "Sub-work items" }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    subIssues: { stateDistributionByIssueId: () => store.distribution, fetchSubIssues: store.fetchSubIssues },
    issue: {
      getIssueById: (id: string) => (id === "parent" ? { completed_sub_issues_count: store.count } : { state_id: id }),
    },
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    getStateById: (id: string) => (store.states[id] ? { group: store.states[id] } : undefined),
  }),
}));
makeAutoObservable(store, { fetchSubIssues: false });
beforeEach(() => {
  store.count = undefined;
  store.states = { a: "completed", b: "started" };
  store.fetchSubIssues.mockClear();
});
afterEach(cleanup);
it("updates from parent count without children in cache or per-parent requests", () => {
  store.count = 0;
  store.states = {};
  const { container } = render(<SubIssuesProgress issueId="parent" total={3} />);
  expect(screen.getByText("0/3")).toBeTruthy();
  act(() =>
    runInAction(() => {
      store.count = 1;
    })
  );
  expect(screen.getByText("1/3")).toBeTruthy();
  expect(container.querySelector("circle[pathLength]")?.getAttribute("stroke-dasharray")).toBe(`${(1 / 3) * 100} 100`);
  expect(store.fetchSubIssues).not.toHaveBeenCalled();
});
it("uses live child states when the parent count is missing", () => {
  render(<SubIssuesProgress issueId="parent" total={2} />);
  expect(screen.getByText("1/2")).toBeTruthy();
  act(() =>
    runInAction(() => {
      store.states.b = "completed";
    })
  );
  expect(screen.getByText("2/2")).toBeTruthy();
});
it("does not treat old distribution groups as current states", () => {
  store.states = {};
  render(<SubIssuesProgress issueId="parent" total={2} projectId="project" workspaceSlug="workspace" />);
  expect(screen.getByText("–/2")).toBeTruthy();
  expect(store.fetchSubIssues).not.toHaveBeenCalled();
});
it.each([
  [-2, 0],
  [9, 3],
])("clamps parent count %s to %s", (count, expected) => {
  store.count = count;
  render(<SubIssuesProgress issueId="parent" total={3} />);
  expect(screen.getByText(`${expected}/3`)).toBeTruthy();
});
it("does not show progress for a leaf", () => {
  const { container } = render(<SubIssuesProgress issueId="leaf" total={0} />);
  expect(container.textContent).toBe("");
  expect(store.fetchSubIssues).not.toHaveBeenCalled();
});
