import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { IFilterInstance } from "@plane/shared-state";
import type { TWorkItemFilterExpression, TWorkItemFilterProperty } from "@plane/types";
import { FiltersRow } from "./filters-row";
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
vi.mock("./filter-item/root", () => ({ FilterItem: () => <span>Priority is urgent</span> }));
vi.mock("./add-filters/button", () => ({ AddFilterButton: () => <button type="button">Add filter</button> }));
function makeFilter(overrides: Partial<IFilterInstance<TWorkItemFilterProperty, TWorkItemFilterExpression>> = {}) {
  const toggleVisibility = vi.fn(),
    clearFilters = vi.fn(async () => {});
  const filter = {
    allConditionsForDisplay: [{ id: "urgent" }],
    configManager: { areConfigsReady: true },
    isVisible: true,
    canClearFilters: true,
    canSaveView: false,
    canUpdateView: false,
    toggleVisibility,
    clearFilters,
    ...overrides,
  } as unknown as IFilterInstance<TWorkItemFilterProperty, TWorkItemFilterExpression>;
  return { filter, toggleVisibility, clearFilters };
}
it("unifies clear all and closing the header filter bar without a separate close button", async () => {
  const { filter, toggleVisibility, clearFilters } = makeFilter();
  render(<FiltersRow filter={filter} />);
  expect(screen.queryByRole("button", { name: "close" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "web.clear_all" }));
  expect(clearFilters).toHaveBeenCalledOnce();
  await waitFor(() => expect(toggleVisibility).toHaveBeenCalledWith(false));
});
it("keeps the close action available when editing is disabled on read-only rows", () => {
  const { filter, toggleVisibility } = makeFilter();
  render(<FiltersRow filter={filter} disabledAllOperations />);
  fireEvent.click(screen.getByRole("button", { name: "close" }));
  expect(toggleVisibility).toHaveBeenCalledWith(false);
});
it("auto-hides an empty editable header filter bar when no conditions or unsaved view changes remain", () => {
  const { filter } = makeFilter({ allConditionsForDisplay: [], canClearFilters: false, canUpdateView: false });
  const { container } = render(<FiltersRow filter={filter} />);
  expect(container.querySelector("[data-filter-toolbar]")).toBeNull();
});
it("does not introduce a page-row close action into embedded modal filters", () => {
  const { filter } = makeFilter();
  render(<FiltersRow filter={filter} variant="modal" />);
  expect(screen.queryByRole("button", { name: "close" })).toBeNull();
});
