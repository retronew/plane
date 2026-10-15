import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { observable } from "mobx";
import { ProjectSearch } from "./search-projects";
import { ProjectLayoutSwitch } from "./layout-switch";
const state = observable({ searchQuery: "", currentWorkspaceDisplayFilters: { layout: "gallery" } });
const updateLayout = vi.fn();
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@/hooks/store/use-project-filter", () => ({
  useProjectFilter: () => ({
    get searchQuery() {
      return state.searchQuery;
    },
    get currentWorkspaceDisplayFilters() {
      return state.currentWorkspaceDisplayFilters;
    },
    updateSearchQuery: (value: string) => {
      state.searchQuery = value;
    },
    updateDisplayFilters: updateLayout,
  }),
}));
beforeEach(() => {
  state.searchQuery = "";
  state.currentWorkspaceDisplayFilters.layout = "gallery";
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
});
it("expands, focuses and clears project search without losing focus", async () => {
  render(<ProjectSearch />);
  fireEvent.click(screen.getByRole("button", { name: "web.project_page.search" }));
  const input = screen.getByRole("searchbox");
  await waitFor(() => expect(document.activeElement).toBe(input));
  fireEvent.change(input, { target: { value: "Example" } });
  expect(state.searchQuery).toBe("Example");
  fireEvent.click(screen.getByRole("button", { name: "common.clear" }));
  expect(state.searchQuery).toBe("");
  expect(document.activeElement).toBe(input);
});
it("exposes four accessible layouts and routes the chosen layout to this workspace", () => {
  render(<ProjectLayoutSwitch />);
  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(screen.getByRole("tab", { name: "web.project_page.layouts.gallery" }).getAttribute("aria-selected")).toBe(
    "true"
  );
  fireEvent.click(screen.getByRole("tab", { name: "web.project_page.layouts.list" }));
  expect(updateLayout).toHaveBeenCalledWith("workspace", { layout: "list" });
});
