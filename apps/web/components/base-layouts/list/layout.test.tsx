import { act, fireEvent, render, screen } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { expect, it, vi } from "vitest";
import { BaseListLayout } from "./layout";

vi.mock("./group", () => ({
  BaseListGroup: ({
    group,
    isCollapsed,
    onToggleGroup,
  }: {
    group: { id: string };
    isCollapsed: boolean;
    onToggleGroup: (id: string) => void;
  }) => (
    <button aria-pressed={isCollapsed} onClick={() => onToggleGroup(group.id)}>
      {group.id}
    </button>
  ),
}));
const props = {
  items: {},
  groups: [
    { id: "b", name: "B" },
    { id: "a", name: "A" },
    { id: "empty", name: "Empty" },
  ],
  groupedItemIds: { a: ["1"], b: ["2"] },
  renderItem: () => null,
};
it("tracks in-place observable collapse changes and preserves group order", () => {
  const collapsedGroups = observable.array(["a", "a", "unknown"]);
  const onToggleGroup = vi.fn();
  render(<BaseListLayout {...props} collapsedGroups={collapsedGroups} onToggleGroup={onToggleGroup} />);
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["b", "a"]);
  expect(screen.getByRole("button", { name: "a" }).getAttribute("aria-pressed")).toBe("true");
  act(() => runInAction(() => collapsedGroups.replace(["b"])));
  expect(screen.getByRole("button", { name: "a" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "b" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "b" }));
  expect(onToggleGroup).toHaveBeenCalledWith("b");
});
it("toggles internal collapse state and can display empty groups", () => {
  render(<BaseListLayout {...props} showEmptyGroups />);
  const button = screen.getByRole("button", { name: "empty" });
  expect(button.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(button);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(button);
  expect(button.getAttribute("aria-pressed")).toBe("false");
});
