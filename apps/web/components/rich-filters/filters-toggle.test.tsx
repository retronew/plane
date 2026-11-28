import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { IFilterInstance } from "@plane/shared-state";
import type { TWorkItemFilterExpression, TWorkItemFilterProperty } from "@plane/types";
import { FiltersToggle } from "./filters-toggle";
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/rich-filters/add-filters/dropdown", () => ({
  AddFilterDropdown: ({
    customButton,
    triggerAriaLabel,
    handleFilterSelect,
  }: {
    customButton: React.ReactNode;
    triggerAriaLabel?: string;
    handleFilterSelect: (property: string, operator: string, isNegation: boolean, value?: unknown) => void;
  }) => (
    <button
      type="button"
      aria-label={triggerAriaLabel}
      onClick={() => handleFilterSelect("priority", "in", false, ["urgent"])}
    >
      {customButton}
    </button>
  ),
}));
it("highlights the filter trigger with an active count badge when conditions are applied", () => {
  const addCondition = vi.fn();
  const toggleVisibility = vi.fn();
  const filter = {
    allConditionsForDisplay: [{ id: "1" }, { id: "2" }],
    isVisible: true,
    addCondition,
    toggleVisibility,
  } as unknown as IFilterInstance<TWorkItemFilterProperty, TWorkItemFilterExpression>;
  render(<FiltersToggle filter={filter} />);
  const button = screen.getByRole("button", { name: "common.filters" });
  expect(button.querySelector("[data-filter-count]")?.textContent).toBe("2");
  expect(button.innerHTML).toContain("bg-accent-subtle!");
  expect(button.innerHTML).toContain("border-accent-strong!");
  fireEvent.click(button);
  expect(addCondition).toHaveBeenCalledOnce();
  expect(toggleVisibility).toHaveBeenCalledWith(true);
});

it("keeps the trigger visually neutral with no count badge when no filters are applied", () => {
  const filter = {
    allConditionsForDisplay: [],
    isVisible: false,
    addCondition: vi.fn(),
    toggleVisibility: vi.fn(),
  } as unknown as IFilterInstance<TWorkItemFilterProperty, TWorkItemFilterExpression>;
  render(<FiltersToggle filter={filter} />);
  const button = screen.getByRole("button", { name: "common.filters" });
  expect(button.querySelector("[data-filter-count]")).toBeNull();
  expect(button.innerHTML).not.toContain("bg-accent-subtle!");
});
