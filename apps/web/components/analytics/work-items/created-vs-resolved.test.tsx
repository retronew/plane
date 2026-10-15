import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { setLanguage } from "@plane/i18n";
import CreatedVsResolved from "./created-vs-resolved";
const get = vi.hoisted(() => vi.fn());
vi.mock("@/services/analytics.service", () => ({
  AnalyticsService: class {
    getAdvanceAnalyticsCharts = get;
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "test" }) }));
vi.mock("@/hooks/store/use-analytics", () => ({
  useAnalytics: () => ({
    selectedProjects: ["p1"],
    selectedDuration: "custom:2026-09-01:2026-10-15",
    selectedCycle: "c1",
    selectedModule: "m1",
    isEpic: true,
    isPeekView: true,
  }),
}));
beforeEach(async () => {
  await setLanguage("zh-CN");
  get.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
function View() {
  return (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <CreatedVsResolved />
    </SWRConfig>
  );
}
it("requests the real trend with both filters and allows toggling each legend", async () => {
  get.mockResolvedValue({
    data: [{ key: "2026-10-01", created_issues: 5, completed_issues: 0 }],
    schema: {},
    granularity: "day",
    period: { start: "2026-10-01", end: "2026-10-15" },
  });
  render(<View />);
  const created = await screen.findByRole("button", { name: "已创建" });
  expect(get).toHaveBeenCalledWith(
    "test",
    "work-items",
    {
      project_ids: "p1",
      date_filter: "custom:2026-09-01:2026-10-15",
      cycle_id: "c1",
      module_id: "m1",
      epic: true,
    },
    true
  );
  expect(screen.queryByRole("button", { name: "查看演示数据" })).toBeNull();
  expect(screen.getByText("按日统计")).toBeTruthy();
  expect(screen.getByText(/统计区间：2026-10-01 至 2026-10-15/)).toBeTruthy();
  expect(created.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(created);
  expect(created.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(created);
  expect(created.getAttribute("aria-pressed")).toBe("true");
});
it("handles empty trends without rendering fabricated series", async () => {
  get.mockResolvedValue({ data: [], schema: {} });
  render(<View />);
  expect(await screen.findByText("暂无数据")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "已创建" })).toBeNull();
});
