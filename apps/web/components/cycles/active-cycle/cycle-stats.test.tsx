import type { PropsWithChildren } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveCycleStats } from "./cycle-stats";

const { peek, filters } = vi.hoisted(() => ({ peek: vi.fn(), filters: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
  getCurrentLanguage: () => "en",
}));
vi.mock("@plane/blocks/icons", () => ({ PriorityIcon: () => <span>High</span> }));
vi.mock("@makeplane/propel/components/tabs", () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return { Tabs: Container, TabsList: Container, TabsPanel: Container, Tab: () => null };
});
vi.mock("@makeplane/propel/components/tooltip", () => ({ Tooltip: ({ children }: PropsWithChildren) => children }));
vi.mock("@/hooks/use-local-storage", () => ({
  default: () => ({ storedValue: "Priority-Issues", setValue: vi.fn() }),
}));
vi.mock("@/hooks/use-intersection-observer", () => ({ useIntersectionObserver: vi.fn() }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issues: { fetchNextActiveCycleIssues: vi.fn() } }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    setPeekIssue: peek,
    issue: {
      getIssueById: () => ({
        id: "issue-1",
        name: "Keyboard issue",
        priority: "high",
        archived_at: "2026-01-01",
        state_id: "state-1",
        target_date: "2026-10-20",
      }),
    },
  }),
}));
vi.mock("@/components/issues/issue-detail/issue-identifier", () => ({
  IssueIdentifier: () => <a href="/issue-1">TEST-1</a>,
}));
vi.mock("@/components/dropdowns/state/state-select", () => ({
  StateSelect: () => (
    <button type="button" disabled>
      State
    </button>
  ),
}));
vi.mock("@/components/core/sidebar/single-progress-stats", () => ({ SingleProgressStats: () => null }));
vi.mock("@/components/empty-state/simple-empty-state-root", () => ({ SimpleEmptyState: () => null }));

describe("ActiveCycleStats priority issue entry", () => {
  it("provides a native button with peek/filter effects and keeps other controls outside it", () => {
    render(
      <ActiveCycleStats
        workspaceSlug="workspace"
        projectId="project"
        cycleId="cycle"
        cycle={null}
        handleFiltersUpdate={filters}
        cycleIssueDetails={{
          issueIds: ["issue-1"],
          issueCount: 1,
          nextPageResults: false,
          nextCursor: "",
          perPageCount: 20,
        }}
      />
    );
    const entry = screen.getByRole("button", { name: /Keyboard issue/ });
    expect(entry.tagName).toBe("BUTTON");
    expect(entry.contains(screen.getByRole("link", { name: "TEST-1" }))).toBe(false);
    expect(entry.contains(screen.getByRole("button", { name: "State" }))).toBe(false);
    entry.focus();
    expect(document.activeElement).toBe(entry);
    fireEvent.click(entry);
    expect(peek).toHaveBeenCalledExactlyOnceWith({
      workspaceSlug: "workspace",
      projectId: "project",
      issueId: "issue-1",
      isArchived: true,
    });
    expect(filters).toHaveBeenCalledExactlyOnceWith([
      { property: "priority", operator: "in", value: ["urgent", "high"] },
    ]);
  });
});
