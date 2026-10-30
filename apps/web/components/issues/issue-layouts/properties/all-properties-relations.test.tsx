import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";

import { IssueProperties } from "./all-properties";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  project: { identifier: "QA", module_view: true, cycle_view: true },
  estimate: false,
}));
vi.mock("@plane/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plane/i18n")>()),
  getCurrentLanguage: () => "zh-CN",
  useTranslation: () => ({
    currentLocale: "zh-CN",
    t: (key: string) =>
      ({
        "common.properties": "属性",
        "common.module": "模块",
        "common.cycle": "周期",
        "common.labels": "标签",
        "common.estimate": "估算",
        "common.clear": "清除",
        "common.order_by.start_date": "开始日期",
        "common.order_by.due_date": "截止日期",
        "project_cycles.date_range": "日期范围",
      })[key] ?? key,
  }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace", projectId: "project" }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => mocks.project }) }));
vi.mock("@/hooks/store/use-label", () => ({ useLabel: () => ({ labelMap: {} }) }));
vi.mock("@/hooks/use-issue-layout-store", () => ({ useIssueStoreType: () => "PROJECT" }));
vi.mock("@/hooks/store/use-issues", () => ({ useIssues: () => ({ issues: {} }) }));
vi.mock("@/hooks/store/estimates", () => ({
  useProjectEstimates: () => ({ areEstimateEnabledByProjectId: () => mocks.estimate }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: () => ({ group: "started" }) }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/dropdowns/cycle/cycle-select", () => ({
  CycleSelect: () => <button type="button">Cycle control</button>,
}));
vi.mock("@/components/dropdowns/estimate/estimate-select", () => ({
  EstimateSelect: () => <button type="button">Estimate control</button>,
}));
vi.mock("@/components/dropdowns/member/member-select", () => ({
  MemberSelect: () => <button type="button">Member control</button>,
}));
vi.mock("@/components/dropdowns/module/module-select", () => ({
  ModuleSelect: () => <button type="button">Module control</button>,
}));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({
  PrioritySelect: () => <button type="button">Priority control</button>,
}));
vi.mock("@/components/dropdowns/state/state-select", () => ({
  StateSelect: () => <button type="button">State control</button>,
}));
vi.mock("./labels", () => ({ IssuePropertyLabels: () => <button type="button">Labels control</button> }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.estimate = false;
  mocks.project.module_view = true;
  mocks.project.cycle_view = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = getStyle(element);
    if (element.hasAttribute("data-issue-list-row")) Object.defineProperty(style, "flexDirection", { value: "row" });
    return style;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { width: this.hasAttribute("data-issue-list-row") ? 360 : 100, height: 20 } as DOMRect;
  });
  Element.prototype.getAnimations ??= () => [];
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function show(displayProperties: import("@plane/types").IIssueDisplayProperties, dates = false) {
  return render(
    <div data-issue-list-row="">
      <IssueProperties
        issue={
          {
            id: "issue",
            project_id: "project",
            state_id: "state",
            sub_issues_count: 0,
            attachment_count: 0,
            link_count: 0,
            start_date: dates ? "2026-10-15" : null,
            target_date: dates ? "2026-10-20" : null,
          } as TIssue
        }
        updateIssue={mocks.update}
        displayProperties={displayProperties}
        isReadOnly={false}
        className="flex"
        activeLayout="List"
      />
    </div>
  );
}
it("counts only enabled relations and excludes dates, disabled estimates and zero badges", async () => {
  show({ modules: true, cycle: true, estimate: true, sub_issue_count: true, attachment_count: true, link: true });
  fireEvent.click(screen.getByText("+2"));
  expect(await screen.findByRole("dialog", { name: "属性" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "属性" })).toBeNull();
  expect(screen.getByText("模块").tagName).toBe("DT");
  expect(screen.getByText("周期").tagName).toBe("DT");
  expect(document.querySelectorAll("dt")).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Module control" })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Cycle control" })).toHaveLength(1);
});
it("counts both set dates separately and labels the labels picker", async () => {
  show({ start_date: true, due_date: true, labels: true }, true);
  fireEvent.click(screen.getByText("+3"));
  expect(await screen.findByText("开始日期", { selector: "dt" })).toBeTruthy();
  expect(screen.getByText("截止日期", { selector: "dt" })).toBeTruthy();
  expect(screen.getByText("标签", { selector: "dt" })).toBeTruthy();
  expect(document.querySelectorAll("dt")).toHaveLength(3);
});
it("counts separate dates and an enabled estimate independently", async () => {
  mocks.estimate = true;
  show({ start_date: true, due_date: true, estimate: true });
  fireEvent.click(screen.getByText("+3"));
  expect(await screen.findByText("开始日期", { selector: "dt" })).toBeTruthy();
  expect(screen.getByText("截止日期", { selector: "dt" })).toBeTruthy();
  expect(screen.getByText("估算", { selector: "dt" })).toBeTruthy();
  expect(document.querySelectorAll("dt")).toHaveLength(3);
});
it("omits relations disabled by the project", () => {
  mocks.project.module_view = false;
  mocks.project.cycle_view = false;
  show({ modules: true, cycle: true, estimate: true, sub_issue_count: true, attachment_count: true, link: true });
  expect(screen.queryByText(/^\+/)).toBeNull();
  expect(document.querySelectorAll("[data-list-property]")).toHaveLength(0);
});
