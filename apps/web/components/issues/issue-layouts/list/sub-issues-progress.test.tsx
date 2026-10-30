import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SubIssuesProgress } from "./sub-issues-progress";

const store = vi.hoisted(() => ({
  distribution: { backlog: ["a"], unstarted: [], started: [], completed: ["b"], cancelled: [] },
  states: { a: "completed", b: "started" } as Record<string, string>,
  fetchSubIssues: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "Sub-work items" }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    subIssues: { stateDistributionByIssueId: () => store.distribution, fetchSubIssues: store.fetchSubIssues },
    issue: { getIssueById: (id: string) => ({ state_id: id }) },
  }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: (id: string) => ({ group: store.states[id] }) }),
}));
it("uses the live child states rather than a stale completed distribution", () => {
  const { container, rerender } = render(<SubIssuesProgress issueId="parent" total={2} />);
  expect(screen.getByText("1/2")).toBeTruthy();
  expect(container.querySelector("circle[pathLength]")?.getAttribute("stroke-dasharray")).toBe("50 100");
  store.states.b = "completed";
  rerender(<SubIssuesProgress issueId="parent" total={2} projectId="project" />);
  expect(screen.getByText("2/2")).toBeTruthy();
});
it("does not show progress for a leaf", () => {
  const { container } = render(<SubIssuesProgress issueId="leaf" total={0} />);
  expect(container.textContent).toBe("");
  expect(store.fetchSubIssues).not.toHaveBeenCalled();
});
