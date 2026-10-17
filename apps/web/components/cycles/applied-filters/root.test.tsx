import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { DATE_AFTER_FILTER_OPTIONS } from "@plane/constants";
import { CycleAppliedFiltersList } from "./root";

const permissions = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: () => permissions.allowed }),
}));
beforeEach(async () => {
  permissions.allowed = true;
  await setLanguage("en");
});
afterEach(async () => {
  await setLanguage("en");
});

it("removes one value, one group, and all filters through real Propel controls", () => {
  const remove = vi.fn();
  const clear = vi.fn();
  render(
    <CycleAppliedFiltersList
      appliedFilters={{
        status: ["current", "draft"],
        start_date: [DATE_AFTER_FILTER_OPTIONS[0].value],
        end_date: ["2026-10-31;before"],
      }}
      handleClearAllFilters={clear}
      handleRemoveFilter={remove}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove In progress" }));
  expect(remove).toHaveBeenLastCalledWith("status", "current");
  fireEvent.click(screen.getByRole("button", { name: "Remove Status" }));
  expect(remove).toHaveBeenLastCalledWith("status", null);
  fireEvent.click(screen.getByRole("button", { name: `Remove ${DATE_AFTER_FILTER_OPTIONS[0].name}` }));
  expect(remove).toHaveBeenLastCalledWith("start_date", DATE_AFTER_FILTER_OPTIONS[0].value);
  fireEvent.click(screen.getByRole("button", { name: /^Remove Before:/ }));
  expect(remove).toHaveBeenLastCalledWith("end_date", "2026-10-31;before");
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(clear).toHaveBeenCalledOnce();
});

it("hides empty filter groups and respects permissions with an explicit editing override", () => {
  permissions.allowed = false;
  const props = { appliedFilters: { status: ["draft"] }, handleClearAllFilters: vi.fn(), handleRemoveFilter: vi.fn() };
  const { rerender } = render(<CycleAppliedFiltersList {...props} />);
  expect(screen.getByText("Draft")).toBeTruthy();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  rerender(<CycleAppliedFiltersList {...props} alwaysAllowEditing />);
  expect(screen.getByRole("button", { name: "Remove Draft" })).toBeTruthy();
  rerender(<CycleAppliedFiltersList {...props} appliedFilters={{ status: [], start_date: [], end_date: [] }} />);
  expect(screen.queryByText("Clear all")).toBeNull();
  expect(screen.queryByText("Status")).toBeNull();
});

it("localizes field, status and custom date chip labels in Chinese", async () => {
  await setLanguage("zh-CN");
  render(
    <CycleAppliedFiltersList
      appliedFilters={{ status: ["current"], end_date: ["2026-10-31;before"] }}
      handleClearAllFilters={vi.fn()}
      handleRemoveFilter={vi.fn()}
    />
  );
  expect(screen.getByText("状态")).toBeTruthy();
  expect(screen.getByRole("button", { name: "移除 进行中" })).toBeTruthy();
  expect(screen.queryByText("end_date")).toBeNull();
});
