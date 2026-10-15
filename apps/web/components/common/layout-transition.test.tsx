import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { LayoutTransition, useLayoutTransitionReady } from "./layout-transition";
beforeEach(() =>
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
);
function finish(element: Element, name: string) {
  const event = new Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: name });
  fireEvent(element, event);
}
function Content({ layout, ready }: { layout: string; ready: boolean }) {
  useLayoutTransitionReady(ready);
  return <div>{ready ? `Content ${layout}` : `Skeleton ${layout}`}</div>;
}
it("waits for loaded content to start the incoming animation, including slow requests", () => {
  const draw = (layout: string, ready: boolean) => (
    <LayoutTransition layout={layout} waitForReady>
      {(shown) => <Content layout={shown} ready={ready} />}
    </LayoutTransition>
  );
  const { container, rerender } = render(draw("list", true));
  const root = container.firstElementChild!;
  finish(root, "project-layout-in");
  rerender(draw("kanban", false));
  expect(root.getAttribute("data-project-transition")).toBe("exit");
  finish(root, "project-layout-out");
  expect(screen.getByText("Skeleton kanban")).toBeTruthy();
  expect(root.getAttribute("data-project-transition")).toBe("loading");
  finish(root, "project-layout-in");
  expect(root.getAttribute("data-project-transition")).toBe("loading");
  rerender(draw("kanban", true));
  expect(root.getAttribute("data-project-transition")).toBe("enter");
  expect(screen.getByText("Content kanban")).toBeTruthy();
  finish(root, "project-layout-in");
  expect(root.getAttribute("data-project-transition")).toBe("idle");
});
it("can leave a loading layout for the latest requested view without getting stuck", () => {
  const draw = (layout: string, ready: boolean) => (
    <LayoutTransition layout={layout} waitForReady>
      {(shown) => <Content layout={shown} ready={ready} />}
    </LayoutTransition>
  );
  const { container, rerender } = render(draw("list", false));
  const root = container.firstElementChild!;
  rerender(draw("calendar", false));
  rerender(draw("gantt", false));
  finish(root, "project-layout-out");
  expect(screen.getByText("Skeleton gantt")).toBeTruthy();
  rerender(draw("gantt", true));
  expect(root.getAttribute("data-project-transition")).toBe("enter");
});

it("commits the query layout only after the outgoing content finishes", () => {
  const commit = vi.fn();
  const draw = (layout: string) => (
    <LayoutTransition layout={layout} onLayoutCommit={commit}>
      {(shown) => <div>{shown}</div>}
    </LayoutTransition>
  );
  const { container, rerender } = render(draw("list"));
  const root = container.firstElementChild!;
  finish(root, "project-layout-in");
  commit.mockClear();
  rerender(draw("calendar"));
  expect(commit).not.toHaveBeenCalled();
  expect(screen.getByText("list")).toBeTruthy();
  finish(root, "project-layout-out");
  expect(commit).toHaveBeenCalledExactlyOnceWith("calendar");
});

it("does not replay entry when the current calendar refetches after an option change", () => {
  const draw = (ready: boolean) => (
    <LayoutTransition layout="calendar" waitForReady>
      {(shown) => <Content layout={shown} ready={ready} />}
    </LayoutTransition>
  );
  const { container, rerender } = render(draw(true));
  const root = container.firstElementChild!;
  finish(root, "project-layout-in");
  rerender(draw(false));
  expect(root.getAttribute("data-project-transition")).toBe("idle");
  rerender(draw(true));
  expect(root.getAttribute("data-project-transition")).toBe("idle");
});
