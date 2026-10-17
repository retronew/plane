import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CyclePeekOverview } from "./cycle-peek-overview";

const state = vi.hoisted(() => ({
  search: new URLSearchParams(),
  push: vi.fn(),
  getCycleById: vi.fn(),
  fetchCycleDetails: vi.fn(),
  fetchArchivedCycleDetails: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: <T,>(component: T) => component }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/projects/project/cycles",
  useSearchParams: () => state.search,
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: state.push }) }));
vi.mock("@/hooks/store/use-cycle", () => ({ useCycle: () => state }));
vi.mock("./analytics-sidebar", () => ({
  CycleDetailsSidebar: (props: {
    cycleId: string;
    projectId: string;
    isArchived?: boolean;
    handleClose: () => void;
  }) => (
    <button onClick={props.handleClose}>
      {props.cycleId}/{props.projectId}/{props.isArchived ? "archived" : "active"}
    </button>
  ),
}));

let reducedMotion = false;
beforeEach(() => {
  vi.clearAllMocks();
  state.search = new URLSearchParams();
  state.getCycleById.mockReturnValue({ project_id: "project" });
  reducedMotion = false;
  // jsdom does not load Tailwind. Model its transition styles for Base UI's
  // animation detection; separately assert the actual motion utilities below.
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = getStyle(element);
    if (!element.hasAttribute("data-cycle-peek")) return style;
    return new Proxy(style, {
      get(target, property) {
        if (property === "transitionDuration") return reducedMotion ? "0s" : "0.4s";
        if (property === "animationName") return "none";
        return Reflect.get(target, property);
      },
    });
  });
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(344);
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
});
afterEach(() => vi.restoreAllMocks());

function renderPeek(props: { projectId?: string; isArchived?: boolean } = {}) {
  const tree = () => <CyclePeekOverview workspaceSlug="workspace" {...props} />;
  const view = render(tree());
  return {
    ...view,
    navigate(query: string) {
      state.search = new URLSearchParams(query);
      view.rerender(tree());
    },
    panel: () => view.container.querySelector("[data-cycle-peek]"),
  };
}

it("opens with the requested motion and preserves other query parameters on close", async () => {
  const view = renderPeek({ projectId: "project" });
  expect(view.panel()).toBeNull();
  view.navigate("peekCycle=cycle-a&tab=all");
  expect(view.panel()?.hasAttribute("data-starting-style")).toBe(true);
  const classes = view.panel()!.classList;
  for (const name of [
    "transition-[width,translate]",
    "duration-[400ms]",
    "ease-[cubic-bezier(0.16,1,0.3,1)]",
    "md:w-[21.5rem]",
    "md:data-[starting-style]:w-0",
    "md:data-[ending-style]:w-0",
    "max-md:data-[starting-style]:translate-x-full",
    "max-md:data-[ending-style]:translate-x-full",
    "motion-reduce:transition-none",
  ])
    expect(classes.contains(name)).toBe(true);
  const content = view.container.querySelector("[data-cycle-details-content]")!;
  for (const name of [
    "w-[min(100vw,21.5rem)]",
    "transition-[translate,opacity]",
    "duration-[400ms]",
    "ease-[cubic-bezier(0.16,1,0.3,1)]",
    "group-data-[starting-style]/cycle-peek:translate-x-4",
    "group-data-[ending-style]/cycle-peek:translate-x-4",
    "group-data-[starting-style]/cycle-peek:opacity-0",
    "group-data-[ending-style]/cycle-peek:opacity-0",
    "motion-reduce:transition-none",
  ])
    expect(content.classList.contains(name)).toBe(true);
  await waitFor(() => expect(view.panel()?.hasAttribute("data-starting-style")).toBe(false));
  expect(state.fetchCycleDetails).toHaveBeenCalledWith("workspace", "project", "cycle-a");
  fireEvent.click(screen.getByRole("button"));
  expect(state.push).toHaveBeenCalledWith("/workspace/projects/project/cycles?tab=all");
});

it("retains the last cycle and derived project until the exit animation finishes", async () => {
  state.search = new URLSearchParams("peekCycle=cycle-a");
  const view = renderPeek({ isArchived: true });
  expect(state.fetchArchivedCycleDetails).toHaveBeenCalledWith("workspace", "project", "cycle-a");
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const animations = vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (this: Element) {
    return this.hasAttribute("data-ending-style") ? [{ finished } as unknown as Animation] : [];
  });
  state.getCycleById.mockReturnValue(undefined);
  view.navigate("");
  await waitFor(() => expect(view.panel()?.hasAttribute("data-ending-style")).toBe(true));
  await waitFor(() => expect(animations.mock.contexts.some((element) => element === view.panel())).toBe(true));
  expect(screen.getByText("cycle-a/project/archived")).toBeTruthy();
  expect(state.fetchArchivedCycleDetails).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await waitFor(() => expect(view.panel()).toBeNull());
});

it("keeps a reopened cycle mounted when an interrupted exit completes", async () => {
  state.search = new URLSearchParams("peekCycle=cycle-a");
  const view = renderPeek({ projectId: "project" });
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const animations = vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (this: Element) {
    return this.hasAttribute("data-ending-style") ? [{ finished } as unknown as Animation] : [];
  });
  view.navigate("");
  await waitFor(() => expect(view.panel()?.hasAttribute("data-ending-style")).toBe(true));
  await waitFor(() => expect(animations).toHaveBeenCalled());
  view.navigate("peekCycle=cycle-b");
  await act(async () => finish());
  expect(screen.getByText("cycle-b/project/active")).toBeTruthy();
  await waitFor(() => expect(view.panel()?.hasAttribute("data-ending-style")).toBe(false));
});

it("unmounts without waiting for animations when reduced motion disables transitions", async () => {
  reducedMotion = true;
  state.search = new URLSearchParams("peekCycle=cycle-a");
  const view = renderPeek({ projectId: "project" });
  vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (this: Element) {
    return this.hasAttribute("data-ending-style")
      ? [{ finished: new Promise<void>(() => {}) } as unknown as Animation]
      : [];
  });
  view.navigate("");
  await waitFor(() => expect(view.panel()).toBeNull());
});
