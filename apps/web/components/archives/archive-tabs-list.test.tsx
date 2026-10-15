import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, Routes, Route } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { ArchiveTabsList } from "./archive-tabs-list";
const state = vi.hoisted(() => ({
  project: { cycle_view: true, module_view: true } as { cycle_view: boolean; module_view: boolean } | undefined,
}));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => state.project }) }));
vi.mock("@plane/i18n", () => ({ translate: (key: string) => key }));
function Page() {
  const { pathname } = useLocation();
  return (
    <>
      <ArchiveTabsList />
      <output>{pathname}</output>
    </>
  );
}
function setup(path = "/workspace/projects/project-1/archives/issues/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:workspaceSlug/projects/:projectId/archives/:tab" element={<Page />} />
      </Routes>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  state.project = { cycle_view: true, module_view: true };
});
it("renders navigable tabs and updates selection with the archive route", () => {
  setup();
  const cycle = screen.getByRole("tab", { name: "web.cycles" });
  expect(cycle.getAttribute("href")).toBe("/workspace/projects/project-1/archives/cycles/");
  fireEvent.click(cycle);
  expect(screen.getByRole("tab", { name: "web.cycles" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "web.work_items_af8f" }).getAttribute("aria-selected")).toBe("false");
  expect(screen.getByRole("status").textContent).toContain("/archives/cycles/");
});
it("only shows archive tabs for enabled project features", () => {
  state.project = { cycle_view: false, module_view: false };
  setup();
  expect(screen.getAllByRole("tab")).toHaveLength(1);
});
it("does not mistake workspace names containing modules for the active route", () => {
  setup("/modules-workspace/projects/project-1/archives/issues/");
  expect(screen.getAllByRole("tab").filter((e) => e.getAttribute("aria-selected") === "true")).toHaveLength(1);
  expect(screen.getByRole("tab", { name: "web.work_items_af8f" }).getAttribute("aria-selected")).toBe("true");
});
it("waits for project data before drawing tabs", () => {
  state.project = undefined;
  setup();
  expect(screen.queryByRole("tablist")).toBeNull();
});
