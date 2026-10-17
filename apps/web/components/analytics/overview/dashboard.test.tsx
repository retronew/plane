import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import TotalInsights from "../total-insights";
import ActiveProjectItem from "./active-project-item";
const mocks = vi.hoisted(() => ({ get: vi.fn(), projects: [] as string[], period: "all_time" }));
vi.mock("@/services/analytics.service", () => ({
  AnalyticsService: class {
    getAdvanceAnalytics = mocks.get;
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "test" }) }));
vi.mock("@/hooks/store/use-analytics", () => ({
  useAnalytics: () => ({ selectedProjects: mocks.projects, selectedDuration: mocks.period, isPeekView: false }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => ({ name: "Core", logo_props: {} }) }),
}));
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.projects = [];
  mocks.period = "all_time";
  await setLanguage("zh-CN");
  mocks.get.mockResolvedValue(
    Object.fromEntries(
      [
        "total_users",
        "total_admins",
        "total_members",
        "total_guests",
        "total_projects",
        "total_work_items",
        "total_cycles",
        "total_intake",
      ].map((key, i) => [key, { count: i }])
    )
  );
});
afterEach(async () => {
  await setLanguage("en");
});
it("preserves all eight real overview counters and links them to their corresponding pages", async () => {
  render(
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map() }}>
        <TotalInsights analyticsType="overview" />
      </SWRConfig>
    </MemoryRouter>
  );
  await screen.findByText("工作项总数");
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(8);
  expect(links.map((el) => el.getAttribute("href"))).toEqual([
    "/test/analytics/work-items/",
    "/test/analytics/projects/",
    "/test/analytics/cycles/",
    "/test/analytics/intake/",
    ...Array(4).fill("/test/analytics/users/"),
  ]);
  for (let i = 0; i < 8; i++) expect(screen.getByText(String(i))).toBeTruthy();
});
it("sends the selected project IDs with the real counters request", async () => {
  mocks.projects = ["p1", "p2"];
  render(
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map() }}>
        <TotalInsights analyticsType="overview" />
      </SWRConfig>
    </MemoryRouter>
  );
  await screen.findByText("工作项总数");
  expect(mocks.get).toHaveBeenCalledWith("test", "overview", { project_ids: "p1,p2" }, false);
});
it("shows a neutral zero progress value and opens the real project without division by zero", () => {
  render(
    <MemoryRouter>
      <ActiveProjectItem project={{ id: "p1", completed_issues: 0, total_issues: 0 }} />
    </MemoryRouter>
  );
  expect(screen.queryByText("0%")).toBeNull();
  expect(screen.getByText("0 个工作项")).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toBe("/test/projects/p1/issues/");
  fireEvent.mouseEnter(screen.getByRole("link"));
});

it("sends the selected period to the backend instead of changing only the filter label", async () => {
  mocks.period = "last_7_days";
  render(
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map() }}>
        <TotalInsights analyticsType="overview" />
      </SWRConfig>
    </MemoryRouter>
  );
  await screen.findByText("工作项总数");
  expect(mocks.get).toHaveBeenCalledWith("test", "overview", { date_filter: "last_7_days" }, false);
});

it("renders a fallback icon when the project has an empty logo object", () => {
  render(
    <MemoryRouter>
      <ActiveProjectItem project={{ id: "p1", completed_issues: 0, total_issues: 5 }} />
    </MemoryRouter>
  );
  const icon = screen.getByRole("link").querySelector("svg");
  expect(icon).toBeTruthy();
  expect(icon?.style.width).toBe("16px");
  expect(icon?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("0%")).toBeTruthy();
});
