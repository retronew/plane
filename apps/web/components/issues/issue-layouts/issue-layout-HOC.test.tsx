import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import { IssueLayoutLoader } from "./issue-layout-HOC";

vi.mock("@/hooks/store/use-issues", () => ({ useIssues: vi.fn() }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: vi.fn() }));
vi.mock("./empty-states", () => ({ IssueLayoutEmptyState: () => null }));
vi.mock("@/components/common/layout-transition", () => ({ useLayoutTransitionReady: vi.fn() }));
vi.mock("@/components/common/layout-error-boundary", () => ({ LayoutErrorBoundary: () => null }));

it.each([EIssueLayoutTypes.LIST, EIssueLayoutTypes.KANBAN])(
  "shows the initial %s skeleton immediately without waiting for a timer",
  (layout) => {
    const { container } = render(<IssueLayoutLoader layout={layout} />);
    expect(container.querySelector(`[data-issue-loader="${layout}"]`)).not.toBeNull();
    expect(container.querySelector('[aria-busy="true"]')?.childElementCount).toBeGreaterThan(0);
  }
);
