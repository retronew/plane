import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { IFilterInstance } from "@plane/shared-state";
import type { TWorkItemFilterExpression, TWorkItemFilterProperty } from "@plane/types";
import { FiltersRow } from "./filters-row";
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("./filter-item/root", () => ({ FilterItem: () => <span>Priority is urgent</span> }));
vi.mock("./add-filters/button", () => ({ AddFilterButton: () => <button type="button">Add filter</button> }));
function makeFilter() {
  const toggleVisibility = vi.fn(),
    clearFilters = vi.fn();
  const filter = {
    allConditionsForDisplay: [{ id: "urgent" }],
    configManager: { areConfigsReady: true },
    isVisible: true,
    canClearFilters: true,
    canSaveView: false,
    canUpdateView: false,
    toggleVisibility,
    clearFilters,
  } as unknown as IFilterInstance<TWorkItemFilterProperty, TWorkItemFilterExpression>;
  return { filter, toggleVisibility, clearFilters };
}
it("closes the header filter row without clearing selected conditions", () => {
  const { filter, toggleVisibility, clearFilters } = makeFilter();
  render(<FiltersRow filter={filter} />);
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  expect(toggleVisibility).toHaveBeenCalledWith(false);
  expect(clearFilters).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "web.clear_all" }));
  expect(clearFilters).toHaveBeenCalledOnce();
});
it("keeps the close action available when editing is disabled", () => {
  const { filter, toggleVisibility } = makeFilter();
  render(<FiltersRow filter={filter} disabledAllOperations />);
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  expect(toggleVisibility).toHaveBeenCalledWith(false);
});
it("does not introduce a page-row close action into embedded modal filters", () => {
  const { filter } = makeFilter();
  render(<FiltersRow filter={filter} variant="modal" />);
  expect(screen.queryByRole("button", { name: "close" })).toBeNull();
});
