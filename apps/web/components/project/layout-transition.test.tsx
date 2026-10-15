import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProjectLayoutTransition } from "./layout-transition";
import { ProjectsLoader } from "../ui/loader/projects-loader";
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: () => "Loading projects" }) }));
beforeEach(() =>
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
);
function endAnimation(element: Element, name: string) {
  const event = new Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: name });
  fireEvent(element, event);
}
const content = (layout: string) => <div data-testid="view">{layout}</div>;
it("pairs exit and enter animations and resolves rapid switches to the latest layout", () => {
  const { container, rerender } = render(<ProjectLayoutTransition layout="gallery">{content}</ProjectLayoutTransition>);
  const root = container.firstElementChild!;
  endAnimation(root, "project-layout-in");
  rerender(<ProjectLayoutTransition layout="board">{content}</ProjectLayoutTransition>);
  expect(root.getAttribute("data-project-transition")).toBe("exit");
  expect(screen.getByTestId("view").textContent).toBe("gallery");
  rerender(<ProjectLayoutTransition layout="list">{content}</ProjectLayoutTransition>);
  endAnimation(screen.getByTestId("view"), "project-layout-out");
  expect(screen.getByTestId("view").textContent).toBe("gallery");
  endAnimation(root, "project-layout-out");
  expect(screen.getByTestId("view").textContent).toBe("list");
  expect(root.getAttribute("data-project-transition")).toBe("enter");
  endAnimation(root, "project-layout-in");
  expect(root.getAttribute("data-project-transition")).toBe("idle");
});
it("switches immediately with reduced motion without waiting for animation events", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { container, rerender } = render(<ProjectLayoutTransition layout="gallery">{content}</ProjectLayoutTransition>);
  rerender(<ProjectLayoutTransition layout="timeline">{content}</ProjectLayoutTransition>);
  expect(screen.getByTestId("view").textContent).toBe("timeline");
  expect(container.firstElementChild?.getAttribute("data-project-transition")).toBe("idle");
});
it.each(["gallery", "board", "list", "timeline"] as const)(
  "provides an accessible %s skeleton with no fake actions",
  (layout) => {
    vi.useFakeTimers();
    const { container } = render(<ProjectsLoader layout={layout} />);
    expect(container.querySelector("[data-project-loader]")).toBeNull();
    act(() => vi.advanceTimersByTime(180));
    expect(container.querySelector(`[data-project-loader="${layout}"]`)).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading projects" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    vi.useRealTimers();
  }
);
