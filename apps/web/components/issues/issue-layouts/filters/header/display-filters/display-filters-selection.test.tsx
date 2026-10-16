import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { ILayoutDisplayFiltersOptions, IIssueDisplayFilterOptions, IIssueDisplayProperties } from "@plane/types";
import { FiltersDropdown } from "../helpers/dropdown";
import { DisplayFiltersSelection } from "./display-filters-selection";
vi.hoisted(() => {
  Element.prototype.getAnimations ??= () => [];
});

const changes = vi.fn();
const configuration: ILayoutDisplayFiltersOptions = {
  display_properties: ["key", "labels", "cycle"],
  display_filters: { group_by: [null, "priority", "state", "cycle"], order_by: ["sort_order", "-created_at"] },
  extra_options: { access: true, values: ["sub_issue", "show_empty_groups"] },
};
function Fixture() {
  const [properties, setProperties] = useState<IIssueDisplayProperties>({ key: true });
  const [filters, setFilters] = useState<IIssueDisplayFilterOptions>({
    layout: "list",
    group_by: null,
    order_by: "sort_order",
    sub_issue: false,
  });
  return (
    <FiltersDropdown displayMenu title="显示">
      <DisplayFiltersSelection
        layoutDisplayFiltersOptions={configuration}
        displayFilters={filters}
        displayProperties={properties}
        cycleViewDisabled
        handleDisplayFiltersUpdate={(next) => {
          changes(next);
          setFilters((prev) => ({ ...prev, ...next }));
        }}
        handleDisplayPropertiesUpdate={(next) => {
          changes(next);
          setProperties((prev) => ({ ...prev, ...next }));
        }}
      />
    </FiltersDropdown>
  );
}
beforeEach(async () => {
  await setLanguage("zh-CN");
  changes.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(async () => {
  await act(() => setLanguage("en"));
  vi.unstubAllGlobals();
});
it("toggles properties and extra options in place without closing the menu", async () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "显示" }));
  const property = await screen.findByRole("menuitemcheckbox", { name: "ID" });
  expect(property.getAttribute("aria-checked")).toBe("true");
  for (const item of screen.getAllByRole("menuitem")) expect(item.querySelector("svg.lucide")).not.toBeNull();
  for (const name of ["显示子工作项", "显示空组"])
    expect(screen.getByRole("menuitemcheckbox", { name }).querySelector("svg.lucide")).not.toBeNull();
  fireEvent.click(property);
  await waitFor(() => expect(changes).toHaveBeenLastCalledWith({ key: false }));
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(property.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "显示子工作项" }));
  await waitFor(() => expect(changes).toHaveBeenLastCalledWith({ sub_issue: true }));
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.queryByRole("menuitemcheckbox", { name: "周期" })).toBeNull();
});
it("uses submenus for grouping and sorting, preserving the allowed option order and source config", async () => {
  const before = JSON.stringify(configuration);
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "显示" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /分组方式/ }));
  const priority = await screen.findByRole("menuitemradio", { name: "优先级" });
  expect(screen.queryByRole("menuitemradio", { name: "周期" })).toBeNull();
  const order = screen.getAllByRole("menuitemradio").map((item) => item.textContent);
  fireEvent.click(priority);
  await waitFor(() => expect(changes).toHaveBeenLastCalledWith({ group_by: "priority" }));
  expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(order);
  expect(JSON.stringify(configuration)).toBe(before);
});
it("offers sort field and direction as separate sibling submenus", async () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole("button", { name: "显示" }));
  const field = await screen.findByRole("menuitem", { name: /排序字段/ });
  const direction = screen.getByRole("menuitem", { name: /排序方向/ });
  expect(direction.parentElement).toBe(field.parentElement);
  expect(direction.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(field);
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "最近创建" }));
  await waitFor(() => expect(changes).toHaveBeenLastCalledWith({ order_by: "-created_at" }));
  fireEvent.click(direction);
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "升序" }));
  await waitFor(() => expect(changes).toHaveBeenLastCalledWith({ order_by: "created_at" }));
  expect(direction.textContent).toContain("升序");
  fireEvent.click(screen.getByRole("menuitemradio", { name: "降序" }));
  await waitFor(() => expect(changes).toHaveBeenLastCalledWith({ order_by: "-created_at" }));
  expect(direction.textContent).toContain("降序");
});
