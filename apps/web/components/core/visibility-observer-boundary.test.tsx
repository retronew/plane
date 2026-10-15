import type { ReactNode } from "react";
import { useEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RenderIfVisible from "./render-if-visible-HOC";
import { VisibilityObserverBoundary, useCollapsibleVisibilityUpdates } from "./visibility-observer-boundary";

let observers: { target?: Element; callback: IntersectionObserverCallback }[];
let reducedMotion = false;
beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  observers = [];
  vi.stubGlobal("matchMedia", () => ({ matches: reducedMotion }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      entry: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback };
        observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.target = target;
      }
      unobserve() {}
    }
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function intersect(visible: boolean) {
  act(() =>
    observers.forEach(({ target, callback }) =>
      callback([{ isIntersecting: visible, target } as IntersectionObserverEntry], {} as IntersectionObserver)
    )
  );
}
function Group({ open, children }: { open: boolean; children: ReactNode }) {
  const onTransitionEnd = useCollapsibleVisibilityUpdates(open);
  return (
    <div data-testid="group" data-closed={open ? undefined : ""} onTransitionEnd={onTransitionEnd}>
      {children}
    </div>
  );
}
function finish() {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: "height" });
  fireEvent(screen.getByTestId("group"), event);
}
it("preserves visible controls during collapse and reuses them on expansion", () => {
  const mounts = vi.fn();
  function Controls() {
    useEffect(mounts, []);
    return <button>Row controls</button>;
  }
  const draw = (open: boolean) => (
    <VisibilityObserverBoundary>
      <Group open={open}>
        <RenderIfVisible preserveWhenCollapsed placeholderChildren={<span>Placeholder</span>}>
          <Controls />
        </RenderIfVisible>
      </Group>
    </VisibilityObserverBoundary>
  );
  const { rerender } = render(draw(true));
  intersect(true);
  expect(mounts).toHaveBeenCalledOnce();
  rerender(draw(false));
  intersect(false);
  finish();
  expect(screen.getByRole("button", { name: "Row controls" })).toBeTruthy();
  rerender(draw(true));
  intersect(true);
  finish();
  expect(mounts).toHaveBeenCalledOnce();
  // Normal scrolling continues to release off-screen controls.
  intersect(false);
  expect(screen.queryByRole("button")).toBeNull();
});
it("defers neighboring rows until motion ends, retaining only the latest intersection", () => {
  const draw = (open: boolean) => (
    <VisibilityObserverBoundary>
      <Group open={open}>
        <RenderIfVisible placeholderChildren="Placeholder">
          <span>Row</span>
        </RenderIfVisible>
      </Group>
    </VisibilityObserverBoundary>
  );
  const { rerender } = render(draw(true));
  rerender(draw(false));
  intersect(true);
  intersect(false);
  intersect(true);
  expect(screen.queryByText("Row")).toBeNull();
  finish();
  expect(screen.getByText("Row")).toBeTruthy();
});
it("releases after interrupted or missing transitions and cancels unmounted rows", () => {
  const draw = (open: boolean, row = true) => (
    <VisibilityObserverBoundary>
      <Group open={open}>
        {row && (
          <RenderIfVisible placeholderChildren="Placeholder">
            <span>Row</span>
          </RenderIfVisible>
        )}
      </Group>
    </VisibilityObserverBoundary>
  );
  const { rerender } = render(draw(true));
  rerender(draw(false));
  intersect(true);
  rerender(draw(true));
  intersect(true);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByText("Row")).toBeTruthy();
  rerender(draw(false));
  intersect(false);
  rerender(draw(false, false));
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByText("Row")).toBeNull();
});
it("does not delay visibility for reduced motion or consumers outside the boundary", () => {
  reducedMotion = true;
  const draw = (open: boolean) => (
    <VisibilityObserverBoundary>
      <Group open={open}>
        <RenderIfVisible placeholderChildren="Placeholder">
          <span>Row</span>
        </RenderIfVisible>
      </Group>
    </VisibilityObserverBoundary>
  );
  const { rerender } = render(draw(true));
  rerender(draw(false));
  intersect(true);
  expect(screen.getByText("Row")).toBeTruthy();
  rerender(
    <RenderIfVisible placeholderChildren="Placeholder">
      <span>Standalone</span>
    </RenderIfVisible>
  );
  intersect(true);
  expect(screen.getByText("Standalone")).toBeTruthy();
});

it("mounts visible rows together before paint while keeping off-screen rows virtualized", () => {
  const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return DOMRect.fromRect({ x: 0, y: this.className === "offscreen" ? 5000 : 80, width: 800, height: 48 });
  });
  try {
    render(
      <VisibilityObserverBoundary>
        <RenderIfVisible renderVisibleBeforePaint placeholderChildren="First placeholder">
          <span>First row</span>
        </RenderIfVisible>
        <RenderIfVisible renderVisibleBeforePaint placeholderChildren="Second placeholder">
          <span>Second row</span>
        </RenderIfVisible>
        <RenderIfVisible renderVisibleBeforePaint classNames="offscreen" placeholderChildren="Offscreen placeholder">
          <span>Offscreen row</span>
        </RenderIfVisible>
      </VisibilityObserverBoundary>
    );
    // No observer delivery is needed to replace the visible placeholders.
    expect(screen.getByText("First row")).toBeTruthy();
    expect(screen.getByText("Second row")).toBeTruthy();
    expect(screen.queryByText("First placeholder")).toBeNull();
    expect(screen.queryByText("Second placeholder")).toBeNull();
    expect(screen.getByText("Offscreen placeholder")).toBeTruthy();
    expect(screen.queryByText("Offscreen row")).toBeNull();
    intersect(false);
    expect(screen.queryByText("First row")).toBeNull();
    expect(screen.getByText("First placeholder")).toBeTruthy();
  } finally {
    rect.mockRestore();
  }
});
