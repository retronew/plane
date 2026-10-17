import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import { setLanguage } from "@plane/i18n";
import type { TPageFilters } from "@plane/types";
import { PageFiltersSelection } from "./root";

vi.mock("@/hooks/store/use-label", () => ({
  useLabel: () => ({
    getProjectLabels: () => [
      { id: "label-1", name: "Product", color: "#3b82f6" },
      { id: "label-2", name: "Design", color: "#8b5cf6" },
    ],
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    getUserDetails: (id: string) => ({ id, display_name: id === "alice" ? "Alice" : "Bob", avatar_url: null }),
  }),
}));
vi.mock("@/components/core/filters/date-filter-modal", () => ({
  DateFilterModal: ({ isOpen, onSelect }: { isOpen: boolean; onSelect: (value: string[]) => void }) =>
    isOpen ? <button onClick={() => onSelect(["2026-10-01;after", "2026-10-17;before"])}>Apply dates</button> : null,
}));
beforeEach(async () => {
  await setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.getAnimations ??= () => [];
});
afterEach(() => vi.unstubAllGlobals());

const base: TPageFilters = { searchQuery: "", sortKey: "updated_at", sortBy: "desc" };
function setup(filters: TPageFilters["filters"] = {}) {
  const change = vi.fn();
  render(
    <Menu defaultOpen>
      <MenuTrigger render={<button>Filters</button>} />
      <MenuContent>
        <PageFiltersSelection
          projectId="project"
          filters={{ ...base, filters }}
          handleFiltersUpdate={change}
          memberIds={["alice", "bob"]}
        />
      </MenuContent>
    </Menu>
  );
  return change;
}

it("searches labels and adds another selection while preserving other filters", async () => {
  const change = setup({ favorites: true, labels: Object.freeze(["label-2"]) as unknown as string[] });
  fireEvent.click(await screen.findByRole("menuitem", { name: /Labels/ }));
  const search = await screen.findByRole("textbox", { name: "Search" });
  fireEvent.change(search, { target: { value: "product" } });
  expect(screen.queryByRole("menuitemcheckbox", { name: "Design" })).toBeNull();
  const option = screen.getByRole("menuitemcheckbox", { name: "Product" });
  expect(option.querySelector("span[style]")?.getAttribute("style")).toContain("59, 130, 246");
  fireEvent.click(option);
  expect(change).toHaveBeenCalledWith("filters", { favorites: true, labels: ["label-2", "label-1"] });
});

it("removes selected labels without losing creators", async () => {
  const change = setup({ created_by: ["alice"], labels: ["label-1"] });
  fireEvent.click(await screen.findByRole("menuitem", { name: /Labels/ }));
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Product" }));
  expect(change).toHaveBeenCalledWith("filters", { created_by: ["alice"], labels: [] });
});

it("uses the shared menu and keeps existing conditions when toggling favorites", async () => {
  const existing = Object.freeze(["alice"]);
  const change = setup({ created_by: existing as unknown as string[] });
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Favorites" }));
  expect(change).toHaveBeenCalledWith("filters", { created_by: ["alice"], favorites: true });
  expect(screen.getByRole("menuitemcheckbox", { name: "Favorites" })).toBeTruthy();
});

it("searches creators and toggles selection without mutating the store array", async () => {
  const change = setup({ favorites: true, created_by: Object.freeze(["alice"]) as unknown as string[] });
  fireEvent.click(await screen.findByRole("menuitem", { name: /Created By/ }));
  const search = await screen.findByRole("textbox", { name: "Search" });
  fireEvent.change(search, { target: { value: "alice" } });
  expect(screen.queryByRole("menuitemcheckbox", { name: "Bob" })).toBeNull();
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Alice/ }));
  expect(change).toHaveBeenCalledWith("filters", { favorites: true, created_by: [] });
});

it("preserves relative date values and other conditions", async () => {
  const change = setup({ favorites: true });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Created date" }));
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "1 week ago" }));
  expect(change).toHaveBeenCalledWith("filters", { favorites: true, created_at: ["1_weeks;before;fromnow"] });
});

it("removes both boundaries of a selected custom range while preserving relative dates", async () => {
  const change = setup({ created_at: ["2026-10-01;after", "2026-10-17;before", "1_weeks;before;fromnow"] });
  fireEvent.click(await screen.findByRole("menuitem", { name: /Created date/ }));
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Custom" }));
  expect(change).toHaveBeenCalledWith("filters", { created_at: ["1_weeks;before;fromnow"] });
});

it("applies custom date ranges through the existing date modal", async () => {
  const change = setup({ created_by: ["alice"] });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Created date" }));
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Custom" }));
  fireEvent.click(await screen.findByRole("button", { name: "Apply dates" }));
  expect(change).toHaveBeenCalledWith("filters", {
    created_by: ["alice"],
    created_at: ["2026-10-01;after", "2026-10-17;before"],
  });
});
