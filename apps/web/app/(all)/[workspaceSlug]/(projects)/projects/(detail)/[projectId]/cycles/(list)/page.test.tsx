import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import ProjectCyclesPage from "./page";

const mocks = vi.hoisted(() => ({
  cycleIds: ["cycle"] as string[] | null,
  completedIds: ["completed"] as string[] | null,
  loader: false,
  fetchedMap: { project: true } as Record<string, boolean>,
  searchQuery: "",
  filters: {} as Record<string, string[]>,
  cycleMap: {} as Record<string, { id: string; status: string; project_id: string; archived_at: string | null }>,
  getFilteredCycleIds: vi.fn(),
  getFilteredCompletedCycleIds: vi.fn(),
}));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({
    loader: mocks.loader,
    fetchedMap: mocks.fetchedMap,
    cycleMap: mocks.cycleMap,
    getCycleById: (id: string) => mocks.cycleMap[id],
    getFilteredCycleIds: mocks.getFilteredCycleIds,
    getFilteredCompletedCycleIds: mocks.getFilteredCompletedCycleIds,
  }),
}));
vi.mock("@/hooks/store/use-cycle-filter", () => ({
  useCycleFilter: () => ({
    currentProjectFilters: mocks.filters,
    searchQuery: mocks.searchQuery,
    clearAllFilters: vi.fn(),
    updateFilters: vi.fn(),
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ name: "Project" }), currentProjectDetails: { cycle_view: true } }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => true }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/cycles/cycles-view-header", () => ({ CyclesViewHeader: () => null }));
vi.mock("@/components/cycles/modal", () => ({ CycleCreateUpdateModal: () => null }));
vi.mock("@/components/cycles/applied-filters", () => ({
  CycleAppliedFiltersList: () => <section aria-label="Applied cycle filters" />,
}));
vi.mock("@makeplane/propel/components/tooltip", () => ({
  Tooltip: ({ label, children }: { label: string; children: React.ReactNode }) => <div title={label}>{children}</div>,
}));
vi.mock("@/components/ui/loader/cycle-module-list-loader", () => ({
  CycleModuleListLayoutLoader: () => <output>Loading cycles</output>,
}));
vi.mock("@/components/empty-state/detailed-empty-state-root", () => ({ DetailedEmptyState: () => null }));
vi.mock("@/components/cycles/cycles-view", () => ({
  CyclesView: ({ tab }: { tab: string }) => <section aria-label={`cycles:${tab}`} />,
}));

const base = "/demo/projects/project/cycles";
function Location() {
  const { pathname, search } = useLocation();
  return (
    <output data-testid="location">
      {pathname}
      {search}
    </output>
  );
}
function setup(url = base, projectId = "project") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ProjectCyclesPage
        {...({ params: { workspaceSlug: "demo", projectId } } as ComponentProps<typeof ProjectCyclesPage>)}
      />
      <Location />
    </MemoryRouter>
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.cycleIds = ["cycle", "current-two", "draft", "upcoming", "completed"];
  mocks.completedIds = ["completed"];
  mocks.loader = false;
  mocks.fetchedMap = { project: true };
  mocks.searchQuery = "";
  mocks.filters = {};
  mocks.cycleMap = Object.fromEntries(
    (
      [
        ["cycle", "Current", "project", null],
        ["current-two", "CURRENT", "project", null],
        ["draft", "DRAFT", "project", null],
        ["upcoming", "Upcoming", "project", null],
        ["completed", "Completed", "project", null],
        ["archived", "current", "project", "2026-01-01"],
        ["other-project", "current", "other", null],
      ] as [string, string, string, string | null][]
    ).map(([id, status, project_id, archived_at]) => [id, { id, status, project_id, archived_at }])
  );
  mocks.getFilteredCycleIds.mockImplementation(() => mocks.cycleIds);
  mocks.getFilteredCompletedCycleIds.mockImplementation(() => mocks.completedIds);
  await setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  Element.prototype.getAnimations ??= () => [];
});
afterEach(() => vi.unstubAllGlobals());

it.each(["", "?tab=unknown"])("defaults to active for query %s without rewriting the URL", (query) => {
  setup(`${base}${query}`);
  expect(screen.getByRole("region", { name: "cycles:active" })).toBeTruthy();
  expect(screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-selected"))).toEqual([
    "true",
    "false",
    "false",
  ]);
  expect(screen.getByTestId("location").textContent).toBe(`${base}${query}`);
});

it.each(["upcoming", "completed"])("restores %s from the query when the page remounts", (tab) => {
  const first = setup(`${base}?tab=${tab}`);
  expect(screen.getByRole("region", { name: `cycles:${tab}` })).toBeTruthy();
  const selected = screen.getAllByRole("tab").filter((item) => item.getAttribute("aria-selected") === "true");
  expect(selected).toHaveLength(1);
  expect(selected[0].getAttribute("href")).toBe(`${base}?tab=${tab}`);
  first.unmount();
  setup(`${base}?tab=${tab}`);
  expect(screen.getByRole("region", { name: `cycles:${tab}` })).toBeTruthy();
  expect(
    screen
      .getAllByRole("tab")
      .find((item) => item.getAttribute("aria-selected") === "true")
      ?.getAttribute("href")
  ).toBe(`${base}?tab=${tab}`);
});

it("navigates real tab links and keeps the rendered view aligned with the query", () => {
  setup();
  for (const [index, tab] of [
    [1, "upcoming"],
    [2, "completed"],
    [0, "active"],
  ] as const) {
    fireEvent.click(screen.getAllByRole("tab")[index]);
    expect(screen.getByTestId("location").textContent).toBe(`${base}?tab=${tab}`);
    expect(screen.getByRole("region", { name: `cycles:${tab}` })).toBeTruthy();
    expect(screen.getAllByRole("tab")[index].getAttribute("aria-selected")).toBe("true");
  }
});

it("hides the count row without search or applied filters", () => {
  setup();
  expect(screen.queryByText("2/2")).toBeNull();
  expect(screen.queryByRole("region", { name: "Applied cycle filters" })).toBeNull();
});

it.each([
  ["active", ["current-two", "draft", "completed"], ["completed"], "1/2"],
  ["upcoming", ["draft", "upcoming", "cycle"], ["completed"], "2/2"],
  ["completed", ["cycle", "draft"], [], "0/1"],
] as const)("counts matching and total cycles only within the %s tab", (tab, pending, completed, count) => {
  mocks.filters = { status: ["current"] };
  mocks.cycleIds = [...pending];
  mocks.completedIds = [...completed];
  setup(`${base}?tab=${tab}`);
  expect(screen.getByText(count)).toBeTruthy();
  expect(screen.getByRole("region", { name: "Applied cycle filters" })).toBeTruthy();
  if (tab === "completed") expect(mocks.getFilteredCompletedCycleIds).toHaveBeenCalledWith("project");
  else expect(mocks.getFilteredCycleIds).toHaveBeenCalledWith("project", false);
});

it("shows a search-only count and tooltip without chips, including zero matches", () => {
  mocks.searchQuery = "no results";
  mocks.cycleIds = [];
  setup();
  expect(screen.getByText("0/2")).toBeTruthy();
  expect(screen.getByTitle("Cycles matching the search and filters: 0 of 2.")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Applied cycle filters" })).toBeNull();
});

it("shows zero of zero for an empty tab with filters", () => {
  mocks.filters = { status: ["current"] };
  mocks.cycleMap = {};
  mocks.cycleIds = [];
  setup();
  expect(screen.getByText("0/0")).toBeTruthy();
});

it("updates the numerator when search results change while retaining the tab total", () => {
  mocks.searchQuery = "first";
  mocks.cycleIds = ["cycle"];
  const first = setup();
  expect(screen.getByText("1/2")).toBeTruthy();
  first.unmount();
  mocks.searchQuery = "no matches";
  mocks.cycleIds = [];
  setup();
  expect(screen.getByText("0/2")).toBeTruthy();
});

it("updates search counts and denominators when switching tabs, including draft cycles", () => {
  mocks.searchQuery = "match";
  mocks.cycleIds = ["current-two", "draft"];
  setup();
  expect(screen.getByText("1/2")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("tab")[1]);
  expect(screen.getByText("1/2")).toBeTruthy();
  expect(screen.getByRole("region", { name: "cycles:upcoming" })).toBeTruthy();
  fireEvent.click(screen.getAllByRole("tab")[2]);
  expect(screen.getByText("1/1")).toBeTruthy();
  expect(screen.getByTitle("Cycles matching the search and filters: 1 of 1.")).toBeTruthy();
});

it.each(["loading", "unfetched", "unresolved"])("hides counts while project data is %s", (state) => {
  mocks.searchQuery = "match";
  if (state === "loading") mocks.loader = true;
  if (state === "unfetched") mocks.fetchedMap = { other: true };
  if (state === "unresolved") mocks.cycleIds = null;
  setup();
  expect(screen.queryByText(/^[0-9]+\/[0-9]+$/)).toBeNull();
});

it("does not count the previous project's cycles before the next project is fetched", () => {
  mocks.searchQuery = "match";
  setup(base.replace("/project/", "/next/"), "next");
  expect(screen.queryByText(/^[0-9]+\/[0-9]+$/)).toBeNull();
});

it.each(["active", "upcoming", "completed"])("delegates an empty project to the %s tab view", (tab) => {
  mocks.cycleIds = [];
  setup(`${base}?tab=${tab}`);
  expect(screen.getByRole("region", { name: `cycles:${tab}` })).toBeTruthy();
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
});
