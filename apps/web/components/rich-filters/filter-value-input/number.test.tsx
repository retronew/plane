import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { FilterInstance, workItemFiltersAdapter } from "@plane/shared-state";
import type { TNumberFilterFieldConfig, TWorkItemFilterExpression, TWorkItemFilterProperty } from "@plane/types";
import { FILTER_FIELD_TYPE, LOGICAL_OPERATOR } from "@plane/types";
import { FilterItem } from "../filter-item/root";
import { NumberFilterValueInput } from "./number";

const config: TNumberFilterFieldConfig = {
  type: FILTER_FIELD_TYPE.NUMBER,
  isOperatorEnabled: true,
  label: "当前状态停留时间",
  unitLabel: "天",
  min: 0,
  max: 365000,
};
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
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("rejects negative, empty and excessive thresholds and applies a fractional number", async () => {
  const change = vi.fn();
  render(<NumberFilterValueInput value={null} config={config} onChange={change} />);
  const input = await screen.findByRole("spinbutton");
  const apply = screen.getByRole("button", { name: "应用" });
  expect((apply as HTMLButtonElement).disabled).toBe(true);
  for (const value of ["-1", "365001", ""]) {
    fireEvent.change(input, { target: { value } });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
  }
  fireEvent.change(input, { target: { value: "1.5" } });
  fireEvent.click(apply);
  expect(change).toHaveBeenCalledExactlyOnceWith(1.5);
});

it("preserves a zero threshold and cancel leaves the applied value unchanged", async () => {
  const change = vi.fn();
  render(<NumberFilterValueInput value={0} config={config} onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "当前状态停留时间" }));
  const input = await screen.findByRole("spinbutton");
  expect((input as HTMLInputElement).value).toBe("0");
  fireEvent.change(input, { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "当前状态停留时间" }).textContent).toContain("0 天");
});

it("round trips both numeric boundaries and updates the value through the real filter chip", async () => {
  const expression = { and: [{ state_duration__gt: 0 }, { state_duration__lt: 2.5 }, { state_group__in: "started" }] };
  expect(workItemFiltersAdapter.toExternal(workItemFiltersAdapter.toInternal(expression)!)).toEqual(expression);
  const changed = vi.fn();
  const filter = new FilterInstance<TWorkItemFilterProperty, TWorkItemFilterExpression>({
    adapter: workItemFiltersAdapter,
    onExpressionChange: changed,
  });
  filter.configManager.registerAll([
    {
      id: "state_duration",
      label: config.label,
      isEnabled: true,
      allowMultipleFilters: true,
      supportedOperatorConfigsMap: new Map([
        ["gt", config],
        ["lt", config],
      ]),
    },
  ]);
  filter.addCondition(LOGICAL_OPERATOR.AND, { property: "state_duration", operator: "gt", value: 1.5 }, false);
  render(<FilterItem condition={filter.allConditions[0]} filter={filter} showTransition={false} />);
  fireEvent.click(screen.getByText("1.5 天"));
  const input = await screen.findByRole("spinbutton");
  fireEvent.change(input, { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "应用" }));
  await waitFor(() => expect(changed).toHaveBeenLastCalledWith({ state_duration__gt: 0 }));
});
