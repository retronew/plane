import { observable, runInAction } from "mobx";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CyclesView } from "./cycles-view";

const mocks = observable(
  {
    pending: ["current-one", "draft", "completed", "current-two", "upcoming", "missing"] as string[] | null,
    completed: ["completed"] as string[] | null,
    searchQuery: "",
    filters: {} as Record<string, string[]>,
    loader: false,
    getFilteredCycleIds: vi.fn(),
    getFilteredCompletedCycleIds: vi.fn(),
  },
  { getFilteredCycleIds: false, getFilteredCompletedCycleIds: false }
);
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({
    loader: mocks.loader,
    getFilteredCycleIds: mocks.getFilteredCycleIds,
    getFilteredCompletedCycleIds: mocks.getFilteredCompletedCycleIds,
    getCycleById: (id: string) => {
      const statuses: Record<string, string> = {
        "current-one": "Current",
        "current-two": "current",
        upcoming: "Upcoming",
        draft: "DRAFT",
        completed: "Completed",
        "completed-two": "COMPLETED",
      };
      const status = statuses[id];
      return status ? { id, status } : undefined;
    },
  }),
}));
vi.mock("@/hooks/store/use-cycle-filter", () => ({
  useCycleFilter: () => ({ searchQuery: mocks.searchQuery, currentProjectFilters: mocks.filters }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Keep the real CyclesList mapping so losing the second active card is observable.
vi.mock("@/components/cycles/active-cycle/project-active-cycle", () => ({
  ProjectActiveCycle: ({
    cycleId,
    projectId,
    workspaceSlug,
  }: {
    cycleId: string;
    projectId: string;
    workspaceSlug: string;
  }) => <article aria-label={`${workspaceSlug}/${projectId}/${cycleId}`} />,
}));
vi.mock("@/components/cycles/list/cycles-list-map", () => ({
  CyclesListMap: ({ cycleIds }: { cycleIds: string[] }) => (
    <ul>
      {cycleIds.map((id) => (
        <li key={id}>{id}</li>
      ))}
    </ul>
  ),
}));
vi.mock("@/components/cycles/cycle-peek-overview", () => ({ CyclePeekOverview: () => null }));
vi.mock("@/components/core/list", () => ({
  ListLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/loader/cycle-module-list-loader", () => ({
  CycleModuleListLayoutLoader: () => <output>Loading cycles</output>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = ["current-one", "draft", "completed", "current-two", "upcoming", "missing"];
  mocks.completed = ["completed"];
  mocks.loader = false;
  mocks.searchQuery = "";
  mocks.filters = {};
  mocks.getFilteredCycleIds.mockImplementation(() => mocks.pending);
  mocks.getFilteredCompletedCycleIds.mockImplementation(() => mocks.completed);
});

it("renders every current cycle as an active card, excluding other groups and missing records", () => {
  render(<CyclesView workspaceSlug="demo" projectId="project" tab="active" />);
  expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label"))).toEqual([
    "demo/project/current-one",
    "demo/project/current-two",
  ]);
  expect(mocks.getFilteredCycleIds).toHaveBeenCalledWith("project", false);
});

it("keeps a search match on the second current cycle and never falls back to unfiltered cards", () => {
  mocks.searchQuery = "second";
  mocks.pending = ["current-two"];
  const { rerender } = render(<CyclesView workspaceSlug="demo" projectId="project" tab="active" />);
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("article", { name: "demo/project/current-two" })).toBeTruthy();
  act(() =>
    runInAction(() => {
      mocks.pending = [];
    })
  );
  rerender(<CyclesView workspaceSlug="demo" projectId="project" tab="active" />);
  expect(screen.queryByRole("article")).toBeNull();
  expect(screen.getByRole("heading", { name: "project_cycles.no_matching_cycles" })).toBeTruthy();
  expect(screen.getByText("project_cycles.remove_search_criteria_to_see_all_cycles")).toBeTruthy();
});

it("includes upcoming and draft cycles in store order, without active or completed cycles", () => {
  render(<CyclesView workspaceSlug="demo" projectId="project" tab="upcoming" />);
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["draft", "upcoming"]);
  expect(screen.queryByRole("article")).toBeNull();
});

it("uses the completed selector rather than the general selector for completed results", () => {
  mocks.completed = ["completed-two", "completed"];
  render(<CyclesView workspaceSlug="demo" projectId="project" tab="completed" />);
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["completed-two", "completed"]);
  expect(mocks.getFilteredCompletedCycleIds).toHaveBeenCalledWith("project");
});

it("switches between the same tab groups used by the counts while preserving search results", () => {
  mocks.searchQuery = "match";
  mocks.pending = ["current-two", "draft"];
  const { rerender } = render(<CyclesView workspaceSlug="demo" projectId="project" tab="active" />);
  expect(screen.getByRole("article", { name: "demo/project/current-two" })).toBeTruthy();
  rerender(<CyclesView workspaceSlug="demo" projectId="project" tab="upcoming" />);
  expect(screen.queryByRole("article")).toBeNull();
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["draft"]);
  rerender(<CyclesView workspaceSlug="demo" projectId="project" tab="completed" />);
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["completed"]);
});

it.each(["active", "upcoming", "completed"] as const)("distinguishes empty %s results from filtered results", (tab) => {
  mocks.pending = [];
  mocks.completed = [];
  const { rerender } = render(<CyclesView workspaceSlug="demo" projectId="project" tab={tab} />);
  expect(screen.getByRole("heading", { name: `project_cycles.empty_state.${tab}.title` })).toBeTruthy();
  expect(screen.getByText(`project_cycles.empty_state.${tab}.description`)).toBeTruthy();
  act(() =>
    runInAction(() => {
      mocks.filters = { status: ["draft"] };
    })
  );
  rerender(<CyclesView workspaceSlug="demo" projectId="project" tab={tab} />);
  expect(screen.getByRole("heading", { name: "project_cycles.no_matching_cycles" })).toBeTruthy();
  expect(screen.getByText("project_cycles.remove_filters_to_see_all_cycles")).toBeTruthy();
});

it.each(["active", "upcoming", "completed"] as const)("shows a loader while the %s selector is unresolved", (tab) => {
  mocks.pending = null;
  mocks.completed = null;
  render(<CyclesView workspaceSlug="demo" projectId="project" tab={tab} />);
  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.queryByRole("heading")).toBeNull();
});
