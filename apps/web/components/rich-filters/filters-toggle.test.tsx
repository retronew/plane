import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { IFilterInstance } from "@plane/shared-state";
import type { TWorkItemFilterExpression, TWorkItemFilterProperty } from "@plane/types";
import { FiltersToggle } from "./filters-toggle";
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/rich-filters/add-filters/button", () => ({
  AddFilterButton: ({ onFilterSelect }: { onFilterSelect: () => void }) => (
    <button type="button" onClick={onFilterSelect}>
      Add a condition
    </button>
  ),
}));
it("preserves the active filter toggle and its pressed state", () => {
  const toggleVisibility = vi.fn();
  const filter = { allConditionsForDisplay: [{}], isVisible: true, toggleVisibility } as unknown as IFilterInstance<
    TWorkItemFilterProperty,
    TWorkItemFilterExpression
  >;
  render(<FiltersToggle filter={filter} />);
  const button = screen.getByRole("button", { name: "common.filters" });
  expect(button.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(button);
  expect(toggleVisibility).toHaveBeenCalledOnce();
});
