import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { setLanguage } from "@plane/i18n";
import { PreviewArea } from "./area";
const get = vi.hoisted(() => vi.fn());
vi.mock("@/services/analytics.service", () => ({
  AnalyticsService: class {
    getAdvanceAnalyticsCharts = get;
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "test" }) }));
vi.mock("@/hooks/store/use-analytics", () => ({
  useAnalytics: () => ({ selectedProjects: ["p1"], selectedDuration: "custom:2026-09-01:2026-10-15" }),
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
      <PreviewArea />
    </SWRConfig>
  );
}
it("requests the real trend with both filters and allows toggling each legend", async () => {
  get.mockResolvedValue({ data: [{ key: "2026-10-01", created_issues: 5, completed_issues: 0 }], schema: {} });
  render(<View />);
  fireEvent.click(screen.getByRole("button", { name: "查看真实数据" }));
  const created = await screen.findByRole("button", { name: "已创建" });
  expect(get).toHaveBeenCalledWith("test", "work-items", {
    project_ids: "p1",
    date_filter: "custom:2026-09-01:2026-10-15",
  });
  expect(created.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(created);
  expect(created.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(created);
  expect(created.getAttribute("aria-pressed")).toBe("true");
});
it("handles empty trends without rendering fabricated series", async () => {
  get.mockResolvedValue({ data: [], schema: {} });
  render(<View />);
  fireEvent.click(screen.getByRole("button", { name: "查看真实数据" }));
  expect(await screen.findByText("暂无数据")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "已创建" })).toBeNull();
});

it("starts with isolated demo data and can return to it from real data", async () => {
  get.mockResolvedValue({ data: [], schema: {} });
  render(<View />);
  expect(screen.getByText(/演示数据 ·/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "已创建" })).toBeTruthy();
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "查看真实数据" }));
  expect(await screen.findByText("暂无数据")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "查看演示数据" }));
  expect(screen.getByText(/演示数据 ·/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "已创建" })).toBeTruthy();
});
