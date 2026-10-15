import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import { setLanguage } from "@plane/i18n";
import type { TAnalyticsDetailTab, IAnalyticsDetailsResponse } from "@plane/types";
import { AnalyticsDetails, DETAIL_COLUMNS } from "./details";
import { exportAnalytics } from "./export";
const mocks = vi.hoisted(() => ({ get: vi.fn(), projects: ["project-1"], slug: "test-workspace" }));
vi.mock("@/services/analytics.service", () => ({
  AnalyticsService: class {
    getAnalyticsDetails = mocks.get;
  },
}));
vi.mock("@/hooks/store/use-analytics", () => ({ useAnalytics: () => ({ selectedProjects: mocks.projects }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: mocks.slug }) }));
vi.mock("./export", () => ({ exportAnalytics: vi.fn() }));
vi.mock("@plane/blocks/charts/bar-chart", () => ({ BarChart: () => <div aria-label="Chart" /> }));
const response: IAnalyticsDetailsResponse = {
  summary: { total_projects: 2 },
  rows: [
    {
      id: "p1",
      name: "Alpha",
      work_items: 2,
      completed: 1,
      members: 2,
      cycles: 1,
      modules: 1,
      pages: 0,
      views: 0,
      intake: 0,
      completion: 50,
      status: "planned",
    },
    { id: "p2", name: "Beta", work_items: 0, completion: 0 },
  ],
  chart: [{ name: "Planned", count: 2 }],
};
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.slug = "test-workspace";
  mocks.projects = ["project-1"];
  mocks.get.mockResolvedValue(response);
  await setLanguage("zh-CN");
});
afterEach(async () => {
  await setLanguage("en");
});
function View({ tab }: { tab: TAnalyticsDetailTab }) {
  return (
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AnalyticsDetails tab={tab} />
      </SWRConfig>
    </MemoryRouter>
  );
}
it.each(["projects", "users", "cycles", "modules", "intake"] as const)(
  "loads real %s data with the active workspace and project filters",
  async (tab) => {
    render(<View tab={tab} />);
    await screen.findByText("Alpha");
    expect(mocks.get).toHaveBeenCalledWith("test-workspace", tab, ["project-1"], undefined);
    expect(screen.getAllByRole("columnheader")).toHaveLength(DETAIL_COLUMNS[tab].length);
    expect(screen.getByRole("button", { name: "导出" })).toBeDefined();
  }
);
it("exports only the currently filtered rows and supports clearing search", async () => {
  render(<View tab="projects" />);
  await screen.findByText("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "Alpha" } });
  await waitFor(() => expect(screen.queryByText("Beta")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "导出" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "CSV" }));
  expect(vi.mocked(exportAnalytics).mock.calls[0][0]).toMatchObject([{ original: { name: "Alpha" } }]);
  fireEvent.click(screen.getByRole("button", { name: "清除" }));
  await screen.findByText("Beta");
});
it("shows a recoverable error instead of fake zeros", async () => {
  mocks.get.mockRejectedValueOnce(new Error("offline"));
  render(<View tab="users" />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Alpha")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await screen.findByText("Alpha");
});
it("uses an empty state and disables export for an actual empty result", async () => {
  mocks.get.mockResolvedValue({ summary: { total_projects: 0 }, rows: [], chart: [] });
  render(<View tab="projects" />);
  await screen.findAllByText("暂无数据");
  expect(screen.getByRole("button", { name: "导出" }).hasAttribute("disabled")).toBe(true);
});
it("reuses the real project table for the dashboard without repeating its summary and chart", async () => {
  render(
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map() }}>
        <AnalyticsDetails tab="projects" embedded />
      </SWRConfig>
    </MemoryRouter>
  );
  await screen.findByText("Alpha");
  expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
    "名称",
    "工作项",
    "已完成",
    "周期",
    "模块",
    "完成率",
  ]);
  expect(screen.queryByLabelText("Chart")).toBeNull();
  expect(screen.getByRole("link", { name: "Alpha" }).getAttribute("href")).toBe("/test-workspace/projects/p1/issues/");
});

it("offers JSON as well as CSV and preserves the current filtered rows", async () => {
  render(<View tab="projects" />);
  await screen.findByText("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Beta" } });
  await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "导出" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "JSON" }));
  expect(vi.mocked(exportAnalytics).mock.calls[0][0]).toMatchObject([{ original: { name: "Beta" } }]);
  expect(vi.mocked(exportAnalytics).mock.calls[0].slice(2)).toEqual(["test-workspace", "json"]);
});

it("exports the current search as Excel through the shared format menu", async () => {
  render(<View tab="projects" />);
  await screen.findByText("Alpha");
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Alpha" } });
  await waitFor(() => expect(screen.queryByText("Beta")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "导出" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Excel" }));
  expect(vi.mocked(exportAnalytics).mock.calls[0][0]).toMatchObject([{ original: { name: "Alpha" } }]);
  expect(vi.mocked(exportAnalytics).mock.calls[0].slice(2)).toEqual(["test-workspace", "xlsx"]);
});
it("fits sparse horizontal charts and recomputes density on the final page", async () => {
  mocks.get.mockResolvedValue({
    ...response,
    chart: Array.from({ length: 22 }, (_, index) => ({ name: `Member ${index}`, count: index + 1 })),
  });
  render(<View tab="users" />);
  const chart = await screen.findByLabelText("Chart");
  expect(chart.parentElement?.style.height).toBe("810px");
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  expect(chart.parentElement?.style.height).toBe("162px");
});
