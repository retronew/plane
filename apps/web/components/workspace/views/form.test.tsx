import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { EIssueLayoutTypes } from "@plane/types";
import type { TWorkItemFilterExpression } from "@plane/types";
import { WorkspaceViewForm } from "./form";
vi.mock("@/components/work-item-filters/filters-hoc/workspace-level", () => ({
  WorkspaceLevelWorkItemFiltersHOC: ({
    updateFilters,
  }: {
    updateFilters: (expression: TWorkItemFilterExpression) => void;
  }) => (
    <button type="button" onClick={() => updateFilters({ priority__in: "high" })}>
      Choose high priority
    </button>
  ),
}));
beforeEach(async () => {
  await setLanguage("zh-CN");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.getAnimations ??= () => [];
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(256);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(240);
});
afterEach(async () => {
  await setLanguage("en");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function renderForm(layout = EIssueLayoutTypes.SPREADSHEET) {
  const submit = vi.fn(async () => {});
  const preLoadedData = {
    name: "测试视图",
    rich_filters: { name__icontains: "登录" },
    display_filters: { layout },
    display_properties: { priority: false, labels: true },
  };
  const view = render(
    <WorkspaceViewForm
      workspaceSlug="workspace"
      handleFormSubmit={submit}
      handleClose={vi.fn()}
      preLoadedData={preLoadedData}
    />
  );
  return { ...view, submit };
}
it.each([
  [EIssueLayoutTypes.LIST, true, false, true],
  [EIssueLayoutTypes.KANBAN, true, true, true],
  [EIssueLayoutTypes.SPREADSHEET, false, false, true],
  [EIssueLayoutTypes.CALENDAR, false, false, false],
  [EIssueLayoutTypes.GANTT, false, false, true],
] as const)("uses the existing %s layout's display capabilities", async (layout, group, subgroup, sort) => {
  renderForm(layout);
  fireEvent.click(screen.getByRole("button", { name: "显示" }));
  await screen.findByRole("menuitemcheckbox", { name: "显示子工作项" });
  expect(!!screen.queryByRole("menuitem", { name: /^分组方式/ })).toBe(group);
  expect(!!screen.queryByRole("menuitem", { name: /^子分组方式/ })).toBe(subgroup);
  expect(!!screen.queryByRole("menuitem", { name: /^排序字段/ })).toBe(sort);
});
it("switches layouts using the shared picker, preserves the query and submits the new layout", async () => {
  const { submit } = renderForm();
  // Pick a layout without re-mounting the form.
  fireEvent.click(screen.getByRole("button", { name: "表格" }));
  fireEvent.click(await screen.findByRole("option", { name: "看板" }));
  await screen.findByRole("combobox", { name: "看板" });
  fireEvent.click(screen.getByRole("button", { name: "Choose high priority" }));
  fireEvent.click(screen.getByRole("button", { name: "创建视图" }));
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0]).toMatchObject([
    {
      display_filters: { layout: "kanban", group_by: "state_detail.group" },
      rich_filters: { priority__in: "high" },
      display_properties: { priority: false, labels: true },
    },
  ]);
});
it("loads a new save-as snapshot when reusing the form, without clobbering edits on ordinary rerenders", async () => {
  const submit = vi.fn(async () => {}),
    close = vi.fn();
  const initial = {
    name: "第一份",
    rich_filters: { priority__in: "high" },
    display_filters: { layout: EIssueLayoutTypes.LIST },
  };
  const { rerender } = render(
    <WorkspaceViewForm
      workspaceSlug="workspace"
      handleFormSubmit={submit}
      handleClose={close}
      preLoadedData={initial}
    />
  );
  fireEvent.change(screen.getByPlaceholderText("标题"), { target: { value: "用户草稿" } });
  rerender(
    <WorkspaceViewForm
      workspaceSlug="workspace"
      handleFormSubmit={submit}
      handleClose={close}
      preLoadedData={initial}
    />
  );
  expect((screen.getByPlaceholderText("标题") as HTMLInputElement).value).toBe("用户草稿");
  rerender(
    <WorkspaceViewForm
      workspaceSlug="workspace"
      handleFormSubmit={submit}
      handleClose={close}
      preLoadedData={{
        name: "第二份",
        rich_filters: { label_id__in: "label" },
        display_filters: { layout: EIssueLayoutTypes.CALENDAR },
      }}
    />
  );
  await waitFor(() => expect((screen.getByPlaceholderText("标题") as HTMLInputElement).value).toBe("第二份"));
  fireEvent.click(screen.getByRole("button", { name: "创建视图" }));
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0]).toMatchObject([
    { name: "第二份", rich_filters: { label_id__in: "label" }, display_filters: { layout: "calendar" } },
  ]);
});
