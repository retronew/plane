import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import { SubIssuesListItemProperties } from "./properties";

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
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: () => ({ group: "started" }) }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserProfile: () => ({ data: { start_of_the_week: 1 } }) }));
vi.mock("@/components/dropdowns/member/member-select", () => ({ MemberSelect: () => null }));
vi.mock("@/components/dropdowns/priority/priority-select", () => ({ PrioritySelect: () => null }));
vi.mock("@/components/dropdowns/state/state-select", () => ({ StateSelect: () => null }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 11, 12));
});
afterEach(() => vi.useRealTimers());

function show(start: string | null, end: string | null) {
  const update = vi.fn();
  render(
    <SubIssuesListItemProperties
      workspaceSlug="workspace"
      parentIssueId="parent"
      issueId="child"
      canEdit
      updateSubIssue={update}
      displayProperties={{ start_date: true, due_date: true }}
      issue={{ id: "child", project_id: "project", start_date: start, target_date: end } as TIssue}
    />
  );
  return update;
}

it.each([
  [null, "2026-12-10", "12/10"],
  ["2026-11-12", null, "11/12"],
  [null, "2027-01-10", "2027/01/10"],
  ["2026-12-01", "2026-12-10", "12/01–10"],
  ["2026-12-30", "2027-01-02", "2026/12/30–2027/01/02"],
])("shows compact child dates (%s, %s)", (from, to, label) => {
  show(from, to);
  expect(screen.getByRole("button", { name: label })).toBeTruthy();
});
it("keeps empty date fields available", () => {
  show(null, null);
  expect(screen.getByRole("button", { name: "开始日期" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "截止日期" })).toBeTruthy();
});
it("clears a merged range through the existing child update operation", async () => {
  const update = show("2026-12-01", "2026-12-10");
  fireEvent.click(screen.getByRole("button", { name: "12/01–10" }));
  fireEvent.click(await screen.findByRole("button", { name: "清除" }));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith("workspace", "project", "parent", "child", {
      start_date: null,
      target_date: null,
    })
  );
});
