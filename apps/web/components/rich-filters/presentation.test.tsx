import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { getDateOperatorLabel, getOperatorLabel } from "@plane/utils";
import type { IFilterInstance } from "@plane/shared-state";
import type { TExternalFilter, TFilterProperty } from "@plane/types";
import { FiltersToggle } from "./filters-toggle";
import { FilterItemContainer } from "./filter-item/container";
import { SelectedOptionsDisplay } from "./filter-value-input/select/selected-options-display";

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
function hover(element: HTMLElement) {
  const trigger = element.closest("[data-base-ui-tooltip-trigger]")!;
  const pointer = new MouseEvent("pointerover", { bubbles: true });
  Object.defineProperty(pointer, "pointerType", { value: "mouse" });
  fireEvent(trigger, pointer);
  fireEvent.mouseEnter(trigger);
  fireEvent.mouseMove(trigger);
}
it("translates comparison operators and date comparisons, including a language switch", async () => {
  expect(getOperatorLabel("exact")).toBe("是");
  expect(getOperatorLabel("in")).toBe("属于任一项");
  expect(getOperatorLabel("range")).toBe("介于");
  expect(getDateOperatorLabel("range")).toBe("介于");
  expect(getOperatorLabel(undefined)).toBe("--");
  await setLanguage("en");
  expect(getOperatorLabel("exact")).toBe("is");
  expect(getOperatorLabel("in")).toBe("is any of");
  expect(getDateOperatorLabel("range")).toBe("between");
});
it("shows a tooltip on the active filter trigger and still toggles the filter row", async () => {
  const toggleVisibility = vi.fn();
  const filter = {
    allConditionsForDisplay: [{ id: "one" }],
    isVisible: false,
    toggleVisibility,
  } as unknown as IFilterInstance<TFilterProperty, TExternalFilter>;
  render(<FiltersToggle filter={filter} />);
  const button = screen.getByRole("button", { name: "筛选" });
  hover(button);
  expect((await screen.findByRole("tooltip")).textContent).toBe("筛选");
  fireEvent.click(button);
  expect(toggleVisibility).toHaveBeenCalledOnce();
  expect(button.getAttribute("aria-pressed")).toBe("false");
});
it("preserves member names, missing-selection counts, and removal controls inside a condition", () => {
  render(
    <FilterItemContainer conditionValue={["ada"]} showTransition={false}>
      <SelectedOptionsDisplay
        selectedValue={["ada"]}
        options={[{ id: "ada", value: "ada", label: "Ada Lovelace", icon: <span aria-label="Ada avatar">A</span> }]}
      />
      <button>Remove</button>
    </FilterItemContainer>
  );
  expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  expect(screen.getByLabelText("Ada avatar")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
});
