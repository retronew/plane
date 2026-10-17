import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ allowed: true, archived: false, snapshots: [] as unknown[], fetch: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("swr", () => ({ default: (key: unknown) => ({ data: key ? state.snapshots : undefined, mutate: vi.fn() }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => state.allowed }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ timezone: "UTC" }), fetchProjectDetails: vi.fn() }),
}));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({
    getCycleById: () => ({
      archived_at: state.archived ? "2026-01-01" : null,
      start_date: "2026-10-01",
      end_date: "2026-10-25",
    }),
    getPlotTypeByCycleId: () => "burndown",
    getEstimateTypeByCycleId: () => "issues",
    setPlotType: vi.fn(),
  }),
}));
vi.mock("@/services/cycle.service", () => ({
  CycleService: class {
    workspaceActiveCyclesProgressPro = state.fetch;
  },
}));
vi.mock("@/components/cycles/active-cycle/project-active-cycle-data", () => ({
  projectCycleChartData: () => ({
    progress_chart: Object.fromEntries(state.snapshots.map((value, index) => [index, value])),
  }),
}));
vi.mock("@/components/active-cycles/cycle-chart", () => ({
  WorkspaceCycleChart: () => <div>shared snapshot chart</div>,
}));
vi.mock("@/components/cycles/analytics-sidebar/issue-progress", () => ({
  validateCycleSnapshot: (value: unknown) => value,
}));
vi.mock("@/components/cycles/dropdowns", () => ({ EstimateTypeDropdown: () => <div>legacy estimate controls</div> }));
vi.mock("@/components/core/sidebar/progress-chart", () => ({ default: () => <div>legacy chart</div> }));
vi.mock("@plane/blocks/select", () => {
  const Select = Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Trigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    Value: () => null,
  });
  return { Select };
});
vi.mock("@plane/blocks/skeleton", () => ({
  Loader: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Item: () => <div>loading chart</div>,
  }),
}));

import { SidebarChart } from "./sidebar-chart";
const props = { workspaceSlug: "workspace", projectId: "project", cycleId: "cycle" };
afterEach(cleanup);
beforeEach(() => {
  state.allowed = true;
  state.archived = false;
  state.snapshots = [];
  state.fetch.mockClear();
});
describe("cycle detail snapshot chart", () => {
  it("renders an explicit empty state for absent history", () => {
    render(<SidebarChart {...props} />);
    expect(screen.getByText("no_data_yet")).toBeTruthy();
    expect(screen.queryByText("loading chart")).toBeNull();
  });
  it("uses the shared chart and four accessible series controls", () => {
    state.snapshots = [{}];
    render(<SidebarChart {...props} />);
    expect(screen.getByText("shared snapshot chart")).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(4);
  });
  it.each(["guest", "archived"])("retains permitted legacy analytics for %s cycles", (mode) => {
    state.allowed = mode !== "guest";
    state.archived = mode === "archived";
    render(<SidebarChart {...props} />);
    expect(screen.getByText("legacy estimate controls")).toBeTruthy();
    expect(screen.queryByText("shared snapshot chart")).toBeNull();
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
