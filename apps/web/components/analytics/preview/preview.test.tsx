import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { SWRConfig } from "swr";
import { setLanguage } from "@plane/i18n";
import { ProjectProgressPreview } from "./projects";
import { QuickInsightsPreview } from "./insights";
const mocks = vi.hoisted(() => ({
  details: vi.fn(),
  chart: vi.fn(),
  projects: ["p1"],
  duration: "custom:2026-10-01:2026-10-14",
}));
vi.mock("@/hooks/store/use-analytics", () => ({
  useAnalytics: () => ({ selectedProjects: mocks.projects, selectedDuration: mocks.duration }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "test" }) }));
vi.mock("@/services/analytics.service", () => ({
  AnalyticsService: class {
    getAnalyticsDetails = mocks.details;
    getAdvanceAnalyticsCharts = mocks.chart;
  },
}));
vi.mock("./chart", () => ({
  PreviewChart: ({
    data,
    onSelect,
  }: {
    data: { key: string; name: string; value: number }[];
    onSelect: (key: string) => void;
  }) => (
    <div data-testid="chart">
      {data.map((row) => (
        <button key={row.key} onClick={() => onSelect(row.key)}>{`chart ${row.name}`}</button>
      ))}
    </div>
  ),
}));
vi.mock("./shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared")>();
  return {
    ...actual,
    PreviewChoice: ({
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
  };
});
function View({ insights = false }: { insights?: boolean }) {
  return (
    <MemoryRouter>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        {insights ? <QuickInsightsPreview /> : <ProjectProgressPreview />}
      </SWRConfig>
    </MemoryRouter>
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  await setLanguage("zh-CN");
  mocks.details.mockResolvedValue({
    rows: [
      { id: "p1", name: "Alpha", work_items: 8, completed: 2, completion: 25, cycles: 0, modules: 0 },
      { id: "p2", name: "Beta", work_items: 0, completed: 0, completion: 0 },
    ],
    summary: {},
    chart: [],
  });
  mocks.chart.mockResolvedValue({
    data: [
      { key: "backlog", name: "backlog", count: 5 },
      { key: "completed", name: "completed", count: 2 },
    ],
    schema: { count: "Count" },
  });
});
it("loads scoped real project data and links chart selection to the table without modifying global filters", async () => {
  render(<View />);
  expect(await screen.findByRole("link", { name: "Alpha" })).toBeTruthy();
  expect(mocks.details).toHaveBeenCalledWith("test", "projects", ["p1"], mocks.duration);
  fireEvent.click(screen.getByRole("button", { name: "chart Alpha" }));
  expect(screen.queryByRole("link", { name: "Beta" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "显示全部" }));
  expect(screen.getByRole("link", { name: "Beta" })).toBeTruthy();
  expect(mocks.projects).toEqual(["p1"]);
});
it("shows localized insight data, scopes requests, filters details and can hide the chart", async () => {
  render(<View insights />);
  expect(await screen.findByRole("button", { name: "待办" })).toBeTruthy();
  expect(mocks.chart).toHaveBeenCalledWith(
    "test",
    "custom-work-items",
    expect.objectContaining({
      project_ids: "p1",
      date_filter: mocks.duration,
      x_axis: "STATE_GROUPS",
      y_axis: "WORK_ITEM_COUNT",
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "chart 待办" }));
  expect(screen.queryByRole("button", { name: "已完成" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "显示全部" }));
  fireEvent.click(screen.getByRole("button", { name: "收起洞察" }));
  expect(screen.queryByTestId("chart")).toBeNull();
  expect(screen.getByRole("button", { name: "已完成" })).toBeTruthy();
});
it("shows an actionable error instead of invented zero statistics", async () => {
  mocks.details.mockRejectedValue(new Error("offline"));
  render(<View />);
  await waitFor(() => expect(screen.queryByTestId("chart")).toBeNull());
  expect(await screen.findByRole("button", { name: /重试/ })).toBeTruthy();
});
it("renders empty project data without fabricated records or enabled export", async () => {
  mocks.details.mockResolvedValue({ rows: [], summary: {}, chart: [] });
  render(<View />);
  expect(await screen.findByRole("button", { name: "导出" })).toHaveProperty("disabled", true);
  expect(screen.queryByRole("link", { name: "Alpha" })).toBeNull();
});
it("changes the statistic metric through the shared select and requests new data", async () => {
  render(<View insights />);
  await screen.findByRole("button", { name: "待办" });
  fireEvent.change(screen.getByRole("combobox", { name: "统计指标" }), { target: { value: "ESTIMATE_POINT_COUNT" } });
  await waitFor(() =>
    expect(mocks.chart).toHaveBeenLastCalledWith(
      "test",
      "custom-work-items",
      expect.objectContaining({ y_axis: "ESTIMATE_POINT_COUNT" })
    )
  );
});
