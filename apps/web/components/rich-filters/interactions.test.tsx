import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { FilterInstance, workItemFiltersAdapter } from "@plane/shared-state";
import { FILTER_FIELD_TYPE, LOGICAL_OPERATOR } from "@plane/types";
import type { TWorkItemFilterProperty, TWorkItemFilterExpression, TFilterConfig } from "@plane/types";
import { setLanguage } from "@plane/i18n";
import { AddFilterDropdown } from "./add-filters/dropdown";
import { TextFilterValueInput } from "./filter-value-input/text";
import { QuickFilterOptions } from "./add-filters/quick-options";
import { loadOptions } from "./filter-value-input/select/shared";

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
});
afterEach(async () => {
  await setLanguage("en");
  vi.unstubAllGlobals();
});
function instance() {
  const changed = vi.fn();
  const filter = new FilterInstance<TWorkItemFilterProperty, TWorkItemFilterExpression>({
    adapter: workItemFiltersAdapter,
    onExpressionChange: changed,
  });
  return { filter, changed };
}
const textConfig: TFilterConfig<TWorkItemFilterProperty> = {
  id: "name",
  label: "标题",
  isEnabled: true,
  supportedOperatorConfigsMap: new Map([["icontains", { type: FILTER_FIELD_TYPE.TEXT, isOperatorEnabled: true }]]),
};
it("preserves punctuation and Chinese text through saved-view serialization", () => {
  const expression = {
    and: [{ name__icontains: "Title, 标题" }, { text__icontains: "中文描述" }, { label_id__in: "one,two" }],
  };
  expect(workItemFiltersAdapter.toExternal(workItemFiltersAdapter.toInternal(expression)!)).toEqual(expression);
});
it("applies a quick value atomically and changing the property emits one complete request", () => {
  const { filter, changed } = instance();
  filter.configManager.registerAll([
    textConfig,
    {
      id: "label_id",
      label: "标签",
      isEnabled: true,
      supportedOperatorConfigsMap: new Map([
        [
          "in",
          {
            type: FILTER_FIELD_TYPE.MULTI_SELECT,
            isOperatorEnabled: true,
            singleValueOperator: "exact",
            getOptions: [],
          },
        ],
      ]),
    },
  ]);
  filter.addCondition(LOGICAL_OPERATOR.AND, { property: "label_id", operator: "in", value: ["label"] }, false);
  expect(changed).toHaveBeenCalledExactlyOnceWith({ label_id__in: "label" });
  changed.mockClear();
  filter.updateConditionProperty(filter.allConditions[0].id, "name", "icontains", false, "标题");
  expect(changed).toHaveBeenCalledExactlyOnceWith({ name__icontains: "标题" });
});
it("defers async options until the field is opened, then selects its value directly", async () => {
  const { filter } = instance();
  const getOptions = vi.fn(async () => [{ id: "label", value: "label", label: "需要审查" }]);
  filter.configManager.registerAll([
    textConfig,
    {
      id: "label_id",
      label: "标签",
      isEnabled: true,
      supportedOperatorConfigsMap: new Map([
        [
          "in",
          { type: FILTER_FIELD_TYPE.MULTI_SELECT, isOperatorEnabled: true, singleValueOperator: "exact", getOptions },
        ],
      ]),
    },
  ]);
  const select = vi.fn();
  render(<AddFilterDropdown filter={filter} handleFilterSelect={select} customButton="筛选" />);
  expect(getOptions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "筛选" }));
  await screen.findByRole("button", { name: "标签" });
  expect(getOptions).not.toHaveBeenCalled();
  // ArrowRight is the keyboard equivalent of the shared flyout's hover action.
  fireEvent.keyDown(screen.getByRole("button", { name: "标签" }), { key: "ArrowRight" });
  fireEvent.click(await screen.findByRole("button", { name: "需要审查" }));
  expect(getOptions).toHaveBeenCalledOnce();
  expect(select).toHaveBeenCalledExactlyOnceWith("label_id", "in", false, ["label"]);
});
it("does not submit on each keystroke and trims only on explicit apply", async () => {
  const change = vi.fn();
  render(<TextFilterValueInput value={undefined} titleOnly onChange={change} />);
  const input = await screen.findByRole("textbox", { name: "搜索标题" });
  fireEvent.change(input, { target: { value: "  中文, Title  " } });
  expect(change).not.toHaveBeenCalled();
  fireEvent.submit(input.closest("form")!);
  expect(change).toHaveBeenCalledExactlyOnceWith("中文, Title");
});
it("cancels draft text without changing the applied condition", async () => {
  const change = vi.fn();
  render(<TextFilterValueInput value="Old" titleOnly={false} onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Old" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "搜索标题和描述" }), { target: { value: "New" } });
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Old" })).toBeTruthy();
});
it("provides retry on failed options and searches values by label", async () => {
  const getOptions = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([
      { id: "1", value: "1", label: "修复" },
      { id: "2", value: "2", label: "文档" },
    ]);
  render(
    <QuickFilterOptions
      config={{ type: FILTER_FIELD_TYPE.MULTI_SELECT, singleValueOperator: "exact", getOptions }}
      onSelect={vi.fn()}
    />
  );
  fireEvent.click(await screen.findByRole("button", { name: "重试" }));
  await screen.findByRole("button", { name: "文档" });
  fireEvent.change(screen.getByRole("textbox", { name: "搜索" }), { target: { value: "修复" } });
  expect(screen.queryByRole("button", { name: "文档" })).toBeNull();
  expect(screen.getByRole("button", { name: "修复" })).toBeTruthy();
});
it("ignores responses from a field that has already been left", async () => {
  let finish!: (values: { id: string; value: string; label: string }[]) => void;
  const old = {
    type: FILTER_FIELD_TYPE.MULTI_SELECT,
    singleValueOperator: "exact" as const,
    getOptions: () =>
      new Promise<{ id: string; value: string; label: string }[]>((resolve) => {
        finish = resolve;
      }),
  };
  const { rerender } = render(<QuickFilterOptions config={old} onSelect={vi.fn()} />);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  rerender(
    <QuickFilterOptions
      config={{ ...old, getOptions: [{ id: "new", value: "new", label: "新选项" }] }}
      onSelect={vi.fn()}
    />
  );
  await screen.findByRole("button", { name: "新选项" });
  await act(async () => finish([{ id: "old", value: "old", label: "旧选项" }]));
  expect(screen.queryByRole("button", { name: "旧选项" })).toBeNull();
});
it("supports static option arrays as well as async loaders", async () => {
  const setOptions = vi.fn();
  await loadOptions({
    config: { type: FILTER_FIELD_TYPE.SINGLE_SELECT, getOptions: [{ id: "one", value: "one", label: "一" }] },
    setOptions,
  });
  expect(setOptions).toHaveBeenCalledExactlyOnceWith([{ id: "one", value: "one", label: "一" }]);
});
