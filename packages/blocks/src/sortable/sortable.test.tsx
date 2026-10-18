import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useDragDropManager } from "@dnd-kit/react";
import { AutoScroller, PointerSensor, KeyboardSensor } from "@dnd-kit/dom";
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

it("row activation accepts title buttons but excludes quick actions and retains keyboard support", async () => {
  const observed: { manager?: ReturnType<typeof useDragDropManager> } = {};
  function Probe() {
    const manager = useDragDropManager();
    useEffect(() => {
      observed.manager = manager;
    }, [manager]);
    return null;
  }
  render(
    <SortableProvider onSortEnd={vi.fn()}>
      <Probe />
      <SortableItem id="row" index={0} group="projects" activation="row">
        {({ handleRef }) => (
          // dnd-kit assigns the interactive role when registering this handle.
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div ref={handleRef} tabIndex={0}>
            <button>Project title</button>
            <div data-sortable-no-drag>
              <button>Quick actions</button>
            </div>
          </div>
        )}
      </SortableItem>
    </SortableProvider>
  );
  await waitFor(() => expect(observed.manager?.registry.draggables.get("row")?.handle).toBeTruthy());
  const source = observed.manager!.registry.draggables.get("row")!;
  const sensors = source.sensors!;
  const pointer = sensors.find((sensor) => typeof sensor === "object" && sensor.plugin === PointerSensor);
  expect(pointer).toBeTruthy();
  expect(sensors).toContain(KeyboardSensor);
  if (!pointer || typeof pointer !== "object" || !pointer.options) throw new Error("Missing row pointer sensor");
  const title = screen.getByRole("button", { name: "Project title" });
  const action = screen.getByRole("button", { name: "Quick actions" });
  expect(pointer.options.preventActivation({ target: title } as unknown as PointerEvent, source)).toBe(false);
  expect(pointer.options.preventActivation({ target: action } as unknown as PointerEvent, source)).toBe(true);
  expect(pointer.options.activationConstraints({ pointerType: "mouse" } as PointerEvent, source)).toHaveLength(1);
  expect(pointer.options.activationConstraints({ pointerType: "touch" } as PointerEvent, source)).toHaveLength(1);
});
