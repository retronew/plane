import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ChartLegend } from "./legend";
import { useChartLegend } from "./legend-state";
const items = [
  { key: "a", label: "Created", color: "blue" },
  { key: "b", label: "Resolved", color: "green" },
];
it("supports hover, keyboard highlighting, independent toggles, and recovery after hiding all series", async () => {
  function Example() {
    const state = useChartLegend(["a", "b"]);
    return (
      <>
        <ChartLegend items={items} interaction={state} />
        <output>
          {state.activeKey}:{state.visibleKeys.join(",")}
        </output>
      </>
    );
  }
  render(<Example />);
  fireEvent.mouseEnter(screen.getByRole("button", { name: "Resolved" }));
  expect(screen.getByRole("status").textContent).toBe("b:a,b");
  fireEvent.mouseLeave(screen.getByRole("button", { name: "Resolved" }));
  fireEvent.click(screen.getByRole("button", { name: "Created" }));
  fireEvent.click(screen.getByRole("button", { name: "Resolved" }));
  expect(screen.getByRole("status").textContent).toBe(":");
  expect(screen.getByRole("button", { name: "Created" }).getAttribute("aria-pressed")).toBe("false");
  screen.getByRole("button", { name: "Created" }).focus();
  await userEvent.setup().keyboard("{Enter}");
  expect(screen.getByRole("status").textContent).toBe("a:a");
});
it("clears hidden and highlighted state when grouping creates new series", () => {
  const { result, rerender } = renderHook(({ keys }) => useChartLegend(keys), { initialProps: { keys: ["a", "b"] } });
  act(() => {
    result.current.onToggle("a");
    result.current.onHover("b");
  });
  rerender({ keys: ["c"] });
  expect(result.current.visibleKeys).toEqual(["c"]);
  expect(result.current.activeKey).toBeNull();
});
