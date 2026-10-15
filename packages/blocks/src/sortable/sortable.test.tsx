import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useDragDropManager } from "@dnd-kit/react";
import { AutoScroller } from "@dnd-kit/dom";
import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import { SortableItem, SortableProvider } from "./sortable";

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

it("registers dedicated handles, live sortable animation and the reduced edge scrolling policy", async () => {
  const observed: { manager?: ReturnType<typeof useDragDropManager> } = {};
  function Probe() {
    const current = useDragDropManager();
    useEffect(() => {
      observed.manager = current;
    }, [current]);
    return null;
  }
  render(
    <SortableProvider onSortEnd={vi.fn()}>
      <Probe />
      <SortableItem id="first" index={0} group="states">
        {({ handleRef }) => (
          <>
            <button ref={handleRef} aria-label="Move first">
              Move
            </button>
            <button>Edit first</button>
          </>
        )}
      </SortableItem>
      <SortableItem id="second" index={1} group="states">
        {({ handleRef }) => <button ref={handleRef}>Move second</button>}
      </SortableItem>
    </SortableProvider>
  );
  await waitFor(() =>
    expect(observed.manager?.registry.draggables.get("first")?.handle).toBe(
      screen.getByRole("button", { name: "Move first" })
    )
  );
  expect(observed.manager?.registry.plugins.get(AutoScroller)?.options).toEqual({ threshold: 0.05, acceleration: 8 });
  expect(observed.manager?.registry.plugins.get(OptimisticSortingPlugin)).toBeInstanceOf(OptimisticSortingPlugin);
  expect(screen.getByRole("button", { name: "Edit first" }).getAttribute("aria-roledescription")).toBeNull();
});
