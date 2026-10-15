import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import { formatCompactDate, formatCompactDateRange } from "@plane/utils";
import { IssueProperties } from "./all-properties";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@plane/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plane/i18n")>()),
  getCurrentLanguage: () => "zh-CN",
  useTranslation: () => ({
    currentLocale: "zh-CN",
    t: (key: string) =>
      ({
        "common.clear": "清除",
        "common.order_by.start_date": "开始日期",
        "common.order_by.due_date": "截止日期",
        "project_cycles.date_range": "日期范围",
      })[key] ?? key,
  }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace", projectId: "project" }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => ({ identifier: "QA" }) }) }));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => ({ labelMap: {} }) }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: () => "PROJECT" }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issues: {} }) }));
vi.mock("@/hooks/store/estimates", () => ({
  useProjectEstimates: () => ({ areEstimateEnabledByProjectId: () => false }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: () => ({ group: "started" }) }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/dropdowns/cycle/cycle-select", () => ({ CycleSelect: () => null }));
vi.mock("@/components/dropdowns/estimate/estimate-select", () => ({ EstimateSelect: () => null }));
vi.mock("@/components/dropdowns/member/member-select", () => ({ MemberSelect: () => null }));
vi.mock("@/components/dropdowns/module/module-select", () => ({ ModuleSelect: () => null }));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({ PrioritySelect: () => null }));
vi.mock("@/components/dropdowns/state/state-select", () => ({ StateSelect: () => null }));
vi.mock("./labels", () => ({ IssuePropertyLabels: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 12));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.getAnimations ??= () => [];
});
afterEach(() => vi.useRealTimers());
function show(start: string | null, end: string | null, activeLayout = "List") {
  return render(
    <IssueProperties
      issue={{ id: "issue", project_id: "project", state_id: "state", start_date: start, target_date: end } as TIssue}
      updateIssue={mocks.update}
      displayProperties={{ start_date: true, due_date: true }}
      isReadOnly={false}
      className=""
      activeLayout={activeLayout}
    />
  );
}
it.each([
  ["2026-10-15", "2026-10-20", "10/15–20"],
  ["2026-10-30", "2026-11-02", "10/30–11/02"],
  ["2026-12-31", "2027-01-02", "2026/12/31–2027/01/02"],
  ["2026-10-15", null, "10/15"],
  ["2025-10-15", null, "2025/10/15"],
  [null, "2027-10-20", "2027/10/20"],
  ["2025-10-15", "2025-10-20", "2025/10/15–20"],
  ["2027-10-30", "2027-11-02", "2027/10/30–11/02"],
  ["2025-12-31", "2026-01-02", "2025/12/31–2026/01/02"],
  [null, "2026-10-20", "10/20"],
])("uses compact labels for list dates (%s, %s)", (from, to, label) => {
  show(from, to);
  expect(screen.getByRole("button", { name: label })).toBeTruthy();
});
it("keeps empty placeholders and existing board date formatting", () => {
  const { unmount } = show(null, null);
  expect(screen.getByRole("button", { name: "开始日期" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "截止日期" })).toBeTruthy();
  unmount();
  show("2026-10-15", "2026-10-20", "Kanban");
  expect(screen.getByRole("button", { name: "2026年10月15日 – 2026年10月20日" })).toBeTruthy();
});
it.each([
  ["2026-10-15", null, "10/15", "开始日期: 2026年10月15日"],
  [null, "2026-10-20", "10/20", "截止日期: 2026年10月20日"],
  ["2026-10-15", "2026-10-20", "10/15–20", "日期范围: 2026年10月15日 - 2026年10月20日"],
])("preserves the full date in tooltips (%s, %s)", async (from, to, label, tooltip) => {
  show(from, to);
  const trigger = screen.getByRole("button", { name: label }).closest("[data-base-ui-tooltip-trigger]")!;
  const pointer = new MouseEvent("pointerover", { bubbles: true });
  Object.defineProperty(pointer, "pointerType", { value: "mouse" });
  fireEvent(trigger, pointer);
  fireEvent.mouseEnter(trigger);
  fireEvent.mouseMove(trigger);
  expect((await screen.findByRole("tooltip")).textContent).toBe(tooltip);
});
it("still clears a compact range through the real calendar", async () => {
  show("2026-10-15", "2026-10-20");
  fireEvent.click(screen.getByRole("button", { name: "10/15–20" }));
  fireEvent.click(await screen.findByRole("button", { name: "清除" }));
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith("project", "issue", { start_date: null, target_date: null })
  );
});
it("returns an empty compact label when both dates are absent", () => {
  expect(formatCompactDateRange({ from: null, to: null })).toBe("");
});

it("changes the year visibility at the local New Year boundary", () => {
  const date = new Date(2026, 11, 31);
  vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
  expect(formatCompactDate(date)).toBe("12/31");
  vi.setSystemTime(new Date(2027, 0, 1));
  expect(formatCompactDate(date)).toBe("2026/12/31");
  expect(formatCompactDateRange({ from: new Date(2026, 11, 30), to: date })).toBe("2026/12/30–31");
});
