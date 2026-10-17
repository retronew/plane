import { readFileSync } from "node:fs";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CycleDetailsPanel } from "./cycle-details-panel";

afterEach(() => vi.restoreAllMocks());

it("animates a detail sidebar's width and retains its children through closing", async () => {
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const styles = getStyle(element);
    return new Proxy(styles, {
      get(target, property) {
        if (property === "transitionDuration") return "0.4s";
        if (property === "animationName") return "none";
        return Reflect.get(target, property);
      },
    });
  });
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(344);
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const getAnimations = vi.fn(function (this: Element) {
    return this.hasAttribute("data-ending-style") ? [{ finished } as unknown as Animation] : [];
  });
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: getAnimations });
  const tree = (open: boolean) => (
    <div className="flex">
      <main className="min-w-0 flex-1">Work items</main>
      <CycleDetailsPanel open={open}>
        <span>Cycle details</span>
      </CycleDetailsPanel>
    </div>
  );
  const view = render(tree(false));
  expect(screen.queryByText("Cycle details")).toBeNull();
  view.rerender(tree(true));
  const panel = view.container.querySelector("[data-cycle-peek]")!;
  expect(panel.parentElement).toBe(screen.getByRole("main").parentElement);
  expect(panel.classList.contains("fixed")).toBe(true);
  expect(panel.classList.contains("md:relative")).toBe(true);
  expect(panel.classList.contains("md:data-[starting-style]:w-0")).toBe(true);
  expect(panel.classList.contains("md:w-[21.5rem]")).toBe(true);
  await waitFor(() => expect(panel.hasAttribute("data-starting-style")).toBe(false));
  view.rerender(tree(false));
  await waitFor(() => expect(panel.hasAttribute("data-ending-style")).toBe(true));
  await waitFor(() => expect(getAnimations.mock.contexts.some((element) => element === panel)).toBe(true));
  expect(screen.getByText("Cycle details")).toBeTruthy();
  await act(async () => finish());
  await waitFor(() => expect(screen.queryByText("Cycle details")).toBeNull());
});

it("uses the shared presence panel on the detail page beside a shrinkable main region", () => {
  const page = readFileSync(
    `${import.meta.dirname}/../../app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/cycles/(detail)/[cycleId]/page.tsx`,
    "utf8"
  );
  expect(page).toContain('className="h-full min-w-0 flex-1 overflow-hidden"');
  expect(page).toContain("<CycleDetailsPanel open={!isSidebarCollapsed}>");
  expect(page).not.toContain("{!isSidebarCollapsed &&");
});
