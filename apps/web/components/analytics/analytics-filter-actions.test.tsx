import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import AnalyticsFilterActions from "./analytics-filter-actions";
vi.hoisted(() => {
  Element.prototype.getAnimations ??= () => [];
});
const state = vi.hoisted(() => ({
  selectedProjects: [] as string[],
  selectedDuration: "all_time",
  updateSelectedProjects: vi.fn(),
  updateSelectedDuration: vi.fn(),
}));
vi.mock("@/hooks/store/use-analytics", () => ({ useAnalytics: () => state }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ joinedProjectIds: ["p1"] }) }));
vi.mock("./select/project", () => ({
  ProjectSelect: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button onClick={() => onChange(["p1"])}>Projects</button>
  ),
}));
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 300));
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
  state.selectedProjects = [];
  state.selectedDuration = "all_time";
  await setLanguage("zh-CN");
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await setLanguage("en");
});
it("uses the existing picker to select a real period and the shared project filter", async () => {
  render(<AnalyticsFilterActions />);
  fireEvent.click(screen.getByRole("button", { name: "全部时间" }));
  fireEvent.click(await screen.findByRole("button", { name: /7/ }));
  expect(state.updateSelectedDuration).toHaveBeenCalledWith("last_7_days");
  fireEvent.click(screen.getByRole("button", { name: "Projects" }));
  expect(state.updateSelectedProjects).toHaveBeenCalledWith(["p1"]);
});
it("keeps project and period controls without an extra clear action", () => {
  state.selectedDuration = "last_7_days";
  state.selectedProjects = ["p1"];
  render(<AnalyticsFilterActions />);
  expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
  expect(screen.getByRole("button", { name: "Projects" })).toBeTruthy();
});
it("selects a closed custom interval only after both dates are picked", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 16));
  render(<AnalyticsFilterActions />);
  fireEvent.click(screen.getByRole("button", { name: "全部时间" }));
  fireEvent.click(await screen.findByRole("button", { name: "自定义范围" }));
  const days = await screen.findAllByRole("button", { name: /2026年10月/ });
  const first = days.find((e) => /10月12日/.test(e.getAttribute("aria-label") ?? ""))!;
  const last = days.find((e) => /10月15日/.test(e.getAttribute("aria-label") ?? ""))!;
  fireEvent.click(first);
  expect(state.updateSelectedDuration).not.toHaveBeenCalled();
  fireEvent.click(last);
  expect(state.updateSelectedDuration).toHaveBeenCalledWith("custom:2026-10-12:2026-10-15");
});
