import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { WorkspaceCycleCard } from "./cycle-card";
import { cycleFixture } from "./fixtures.test-support";

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
  Element.prototype.getAnimations ??= () => [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(256);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(240);
});
afterEach(() => vi.restoreAllMocks());
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => (values?.count === undefined ? key : `${key}:${values.count}`),
  }),
  translate: (key: string) => key,
}));
vi.mock("@plane/blocks/emoji-icon-picker", () => ({ Logo: () => <span>Logo</span> }));
vi.mock("./cycle-chart", () => ({
  WorkspaceCycleChart: ({ hidden }: { hidden: Set<string> }) => <div data-testid="chart">{[...hidden].join(",")}</div>,
}));

it("links to the correct cycle and toggles the matching chart series with native buttons", () => {
  render(
    <MemoryRouter>
      <WorkspaceCycleCard cycle={cycleFixture} workspaceSlug="demo" />
    </MemoryRouter>
  );
  expect(screen.getByRole("button", { name: "workspace_cycles.view_cycle" }).getAttribute("href")).toBe(
    "/demo/projects/project-one/cycles/cycle-one/"
  );
  const pending = screen.getByRole("button", { name: /workspace_cycles.pending/ });
  expect(pending.textContent).toContain("7");
  expect(pending.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(pending);
  expect(pending.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByTestId("chart").textContent).toBe("actual");
  expect(screen.getByText("workspace_cycles.cancelled_excluded:1")).toBeTruthy();
  expect(screen.getByText("workspace_cycles.on_track")).toBeTruthy();
  expect(screen.queryByText("workspace_cycles.leading:0")).toBeNull();
});

it("updates the cycle progress icon using completed items over the scope excluding cancellations", () => {
  const { rerender } = render(
    <MemoryRouter>
      <WorkspaceCycleCard cycle={cycleFixture} workspaceSlug="demo" />
    </MemoryRouter>
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("36");
  rerender(
    <MemoryRouter>
      <WorkspaceCycleCard cycle={{ ...cycleFixture, completed_issues: 11 }} workspaceSlug="demo" />
    </MemoryRouter>
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  rerender(
    <MemoryRouter>
      <WorkspaceCycleCard cycle={{ ...cycleFixture, cancelled_issues: 12, completed_issues: 0 }} workspaceSlug="demo" />
    </MemoryRouter>
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
});

it("shows the matching trend for positive and negative differences", () => {
  const { rerender } = render(
    <MemoryRouter>
      <WorkspaceCycleCard cycle={{ ...cycleFixture, completed_issues: 5 }} workspaceSlug="demo" />
    </MemoryRouter>
  );
  expect(screen.getByText("workspace_cycles.leading:1")).toBeTruthy();
  rerender(
    <MemoryRouter>
      <WorkspaceCycleCard cycle={{ ...cycleFixture, completed_issues: 3 }} workspaceSlug="demo" />
    </MemoryRouter>
  );
  expect(screen.getByText("workspace_cycles.lagging:1")).toBeTruthy();
});

it("shows pending rather than a duplicate completed count in other states for the burn-up chart", async () => {
  render(
    <MemoryRouter>
      <WorkspaceCycleCard cycle={cycleFixture} workspaceSlug="demo" />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("button", { name: "web.burn_down" }));
  fireEvent.click(await screen.findByRole("option", { name: "web.burn_up" }));
  expect(await screen.findByText("workspace_cycles.ideal_completed")).toBeTruthy();
  expect(screen.getByRole("button", { name: /workspace_cycles.completed/ }).textContent).toContain("4");
  expect(screen.getByText("workspace_cycles.pending").parentElement?.textContent).toContain("7");
});
