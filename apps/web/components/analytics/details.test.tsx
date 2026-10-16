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
vi.mock("./work-items/created-vs-resolved", () => ({ default: () => <div aria-label="Trend" /> }));
vi.mock("./comparison-chart", () => ({
  ComparisonChart: ({ data, onSelect }: { data: { key: string; name: string }[]; onSelect: (id: string) => void }) => (
    <div aria-label="Chart">
      {data.map((row) => (
        <button key={row.key} onClick={() => onSelect(row.key)}>
          Compare {row.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("./choice", () => ({
  AnalyticsChoice: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string;
    options: { id: string; label: string }[];
    onChange: (value: string) => void;
  }) => (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
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

it("places project methodology after the relevant chart and table", async () => {
  render(<View tab="projects" />);
  await screen.findByText("Alpha");
  expect(screen.getByRole("heading", { name: "项目进展" })).toBeTruthy();
  const chartNote = screen.getByText(/按数值从高到低排列/).closest("aside");
  const tableNote = screen.getByText(/时间筛选按创建日期/).closest("aside");
  expect(chartNote).toBeTruthy();
  expect(tableNote).toBeTruthy();
  expect(
    screen.getByLabelText("Chart").compareDocumentPosition(chartNote!) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(screen.getByRole("table").compareDocumentPosition(tableNote!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("links project summary metrics to their relevant details", async () => {
  mocks.get.mockResolvedValue({ ...response, summary: { total_projects: 2, work_items: 2, completed: 1 } });
  render(<View tab="projects" />);
  await screen.findByText("Alpha");
  expect(screen.getByRole("link", { name: "项目总数 2" }).getAttribute("href")).toBe("/#project-progress");
  expect(screen.getByRole("link", { name: "工作项 2" }).getAttribute("href")).toBe(
    "/test-workspace/analytics/work-items/"
  );
  expect(screen.getByRole("link", { name: "已完成 1" }).getAttribute("href")).toBe(
    "/test-workspace/analytics/work-items/"
  );
});

it.each([
  { tab: "modules" as const, title: "模块进展", summary: { total_modules: 2, completed: 1 } },
  { tab: "users" as const, title: "用户工作量", summary: { total_users: 2, unique_work_items: 2 } },
  { tab: "cycles" as const, title: "周期进展", summary: { total_cycles: 2, current: 1, upcoming: 0, completed: 1 } },
])("uses scoped metric links and contextual notes for $tab", async ({ tab, title, summary }) => {
  mocks.get.mockResolvedValue({ ...response, summary });
  render(<View tab={tab} />);
  await screen.findByText("Alpha");
  expect(screen.getByRole("heading", { name: title })).toBeTruthy();
  const note = screen.getByText(/时间筛选按创建日期/).closest("aside");
  expect(note).toBeTruthy();
  expect(screen.getByRole("table").compareDocumentPosition(note!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  if (tab === "cycles") {
    expect(screen.getByRole("link", { name: "已结束周期 1" }).getAttribute("href")).toBe("/#analytics-cycles-details");
  } else if (tab === "users") {
    expect(screen.getByRole("link", { name: "去重工作项 2" }).getAttribute("href")).toBe(
      "/test-workspace/analytics/work-items/"
    );
    expect(screen.queryByText(/完成率 =/)).toBeNull();
    expect(screen.getByText(/多人共同负责的工作项/).closest("aside")).toBeTruthy();
  }
});

it("links module projects and owners using IDs and renders the shared status icon", async () => {
  mocks.get.mockResolvedValue({
    ...response,
    summary: { total_modules: 1 },
    rows: [
      {
        id: "m1",
        name: "Delivery",
        project_id: "p1",
        project: "Project",
        lead: "Ada",
        lead_id: "u1",
        status: "in-progress",
        completion: 50,
      },
    ],
  });
  render(<View tab="modules" />);
  expect((await screen.findByRole("link", { name: "Delivery" })).getAttribute("href")).toBe(
    "/test-workspace/projects/p1/modules/m1/"
  );
  expect(screen.getByRole("link", { name: "Project" }).getAttribute("href")).toBe(
    "/test-workspace/projects/p1/issues/"
  );
  expect(screen.getByRole("link", { name: /Ada/ }).getAttribute("href")).toBe("/test-workspace/profile/u1/");
  expect(screen.getByText("进行中").parentElement?.querySelector("svg")).toBeTruthy();
});
it("opens intake rows in the corresponding project intake", async () => {
  render(<View tab="intake" />);
  expect((await screen.findByRole("link", { name: "Alpha" })).getAttribute("href")).toBe(
    "/test-workspace/projects/p1/intake/"
  );
  expect(screen.getByRole("heading", { name: "收集明细" })).toBeTruthy();
});

it("keeps compact dates on one line while retaining years outside the current year", async () => {
  const year = new Date().getFullYear();
  mocks.get.mockResolvedValue({
    ...response,
    rows: [{ id: "c1", name: "Dates", project_id: "p1", start_date: `${year - 1}-10-12`, end_date: `${year}-10-19` }],
  });
  render(<View tab="cycles" />);
  await screen.findByText("Dates");
  expect(screen.getByText(`${year - 1}/10/12`).className).toContain("whitespace-nowrap");
  expect(screen.getByText("10/19").className).toContain("whitespace-nowrap");
});

it("filters full project details and exports the chart selection without changing global filters", async () => {
  render(<View tab="projects" />);
  await screen.findByRole("link", { name: "Alpha" });
  fireEvent.click(screen.getByRole("button", { name: "Compare Alpha" }));
  expect(screen.queryByRole("link", { name: "Beta" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "导出" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "CSV" }));
  expect(vi.mocked(exportAnalytics).mock.calls[0][0]).toMatchObject([{ original: { id: "p1" } }]);
  expect(mocks.projects).toEqual(["project-1"]);
  fireEvent.change(screen.getByRole("combobox", { name: "分析方式" }), { target: { value: "statuses" } });
  expect(screen.getByRole("link", { name: "Beta" })).toBeTruthy();
  expect(screen.getByText("按项目当前状态统计项目数量，与工作项状态及完成率无关。")).toBeTruthy();
});

it("clears the project comparison selection when the global project scope changes", async () => {
  const view = render(<View tab="projects" />);
  await screen.findByRole("button", { name: "Compare Alpha" });
  fireEvent.click(screen.getByRole("button", { name: "Compare Alpha" }));
  expect(screen.queryByRole("link", { name: "Beta" })).toBeNull();
  mocks.projects = ["project-2"];
  view.rerender(<View tab="projects" />);
  expect(await screen.findByRole("link", { name: "Beta" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "显示全部" })).toBeNull();
});
