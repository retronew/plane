import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ModulePeekOverview } from "./module-peek-overview";

const mocks = vi.hoisted(() => ({
  query: "peekModule=module&status=planned",
  push: vi.fn(),
  fetchModuleDetails: vi.fn(),
  fetchArchivedModuleDetails: vi.fn(),
}));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/modules",
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/store/use-module", () => ({ useModule: () => mocks }));
vi.mock("./", () => ({
  ModuleAnalyticsSidebar: ({ moduleId, handleClose }: { moduleId: string; handleClose: () => void }) => (
    <button onClick={handleClose}>{moduleId}</button>
  ),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("preserves other filters on Escape and retains an inert panel for its exit animation", () => {
  vi.useFakeTimers();
  mocks.query = "peekModule=module&status=planned";
  const { rerender } = render(<ModulePeekOverview workspaceSlug="workspace" projectId="project" />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(mocks.push).toHaveBeenCalledWith("/modules?status=planned");
  expect(mocks.fetchModuleDetails).toHaveBeenCalledWith("workspace", "project", "module");
  mocks.query = "status=planned";
  rerender(<ModulePeekOverview workspaceSlug="workspace" projectId="project" />);
  expect(screen.getByText("module").parentElement?.hasAttribute("inert")).toBe(true);
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.queryByText("module")).toBeNull();
});
