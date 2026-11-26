import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import { IssueLayoutLoader } from "./issue-layout-HOC";

vi.mock("@/hooks/store/use-issues", () => ({ useIssues: vi.fn() }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: vi.fn() }));
vi.mock("./empty-states", () => ({ IssueLayoutEmptyState: () => null }));
vi.mock("@/components/common/layout-transition", () => ({ useLayoutTransitionReady: vi.fn() }));
vi.mock("@/components/common/layout-error-boundary", () => ({ LayoutErrorBoundary: () => null }));

it("matches the card body and footer to the board's visible properties", () => {
  const { container, rerender } = render(
    <IssueLayoutLoader layout={EIssueLayoutTypes.KANBAN} displayProperties={{ labels: true, assignee: true }} />
  );
  const firstCard = () => container.querySelector("[data-kanban-card-skeleton]")!;
  expect(firstCard().querySelector("[data-kanban-skeleton-properties]")).not.toBeNull();
  expect(firstCard().querySelector("[data-kanban-skeleton-footer]")).not.toBeNull();
  rerender(<IssueLayoutLoader layout={EIssueLayoutTypes.KANBAN} displayProperties={{ state: true, key: true }} />);
  expect(firstCard().querySelector("[data-kanban-skeleton-properties]")).toBeNull();
  expect(firstCard().querySelector("[data-kanban-skeleton-footer]")).toBeNull();
});

it.each([EIssueLayoutTypes.LIST, EIssueLayoutTypes.KANBAN])(
  "shows the initial %s skeleton immediately without waiting for a timer",
  (layout) => {
    const { container } = render(<IssueLayoutLoader layout={layout} />);
    expect(container.querySelector(`[data-issue-loader="${layout}"]`)).not.toBeNull();
    expect(container.querySelector('[aria-busy="true"]')?.childElementCount).toBeGreaterThan(0);
  }
);
