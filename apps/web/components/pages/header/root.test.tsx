import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { PagesListHeaderRoot } from "./root";
import type { EPageStoreType } from "@/hooks/store";

const store = vi.hoisted(() => ({
  filters: {
    searchQuery: "query",
    sortBy: "desc",
    sortKey: "updated_at",
    filters: {
      favorites: true,
      created_by: ["alice"],
      created_at: ["1_weeks;before;fromnow"],
      labels: ["label-1", "label-2"],
    },
  },
  getCurrentProjectPageIdsByTab: () => ["first", "second", "third"],
  getCurrentProjectFilteredPageIdsByTab: () => ["first"],
  updateFilters: vi.fn(),
  clearAllFilters: vi.fn(),
}));
vi.mock("@/hooks/store", () => ({ usePageStore: () => store }));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ workspace: { workspaceMemberIds: [] } }) }));
afterEach(async () => {
  await setLanguage("en");
});
vi.mock("../list/tab-navigation", () => ({ PageTabNavigation: () => null }));
vi.mock("../list/search-input", () => ({ PageSearchInput: () => null }));
vi.mock("../list/order-by", () => ({ PageOrderByDropdown: () => null }));
vi.mock("../list/filters", () => ({ PageFiltersSelection: () => null }));
vi.mock("../list/applied-filters", () => ({
  PageAppliedFiltersList: ({
    handleRemoveFilter,
    handleClearAllFilters,
  }: {
    handleRemoveFilter: (key: string, value: string | null) => void;
    handleClearAllFilters: () => void;
  }) => (
    <>
      <button onClick={() => handleRemoveFilter("created_by", "alice")}>Remove creator</button>
      <button onClick={() => handleRemoveFilter("favorites", null)}>Remove favorites</button>
      <button onClick={() => handleRemoveFilter("labels", "label-1")}>Remove label</button>
      <button onClick={() => handleRemoveFilter("labels", null)}>Remove labels</button>
      <button onClick={handleClearAllFilters}>Clear all</button>
    </>
  ),
}));

it.each([
  ["zh-CN", "共 3 个页面，其中 1 个符合筛选条件。"],
  ["en", "1 of 3 pages match the applied filters."],
] as const)("shows the complete matching-page explanation on hover in %s", async (language, expected) => {
  await setLanguage(language);
  render(
    <PagesListHeaderRoot
      pageType="public"
      projectId="project"
      workspaceSlug="workspace"
      storeType={"project" as EPageStoreType}
    />
  );
  const badge = screen.getByText("1/3").closest("[data-base-ui-tooltip-trigger]")!;
  fireEvent.mouseEnter(badge);
  fireEvent.mouseMove(badge);
  expect(await screen.findByRole("tooltip")).toHaveProperty("textContent", expected);
});

it("keeps unrelated query conditions when removing one applied filter and delegates clear all", () => {
  render(
    <PagesListHeaderRoot
      pageType="public"
      projectId="project"
      workspaceSlug="workspace"
      storeType={"project" as EPageStoreType}
    />
  );
  expect(screen.getByRole("button", { name: "Filters" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("1/3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove creator" }));
  expect(store.updateFilters).toHaveBeenLastCalledWith("filters", { ...store.filters.filters, created_by: [] });
  fireEvent.click(screen.getByRole("button", { name: "Remove favorites" }));
  expect(store.updateFilters).toHaveBeenLastCalledWith("filters", { ...store.filters.filters, favorites: false });
  fireEvent.click(screen.getByRole("button", { name: "Remove label" }));
  expect(store.updateFilters).toHaveBeenLastCalledWith("filters", { ...store.filters.filters, labels: ["label-2"] });
  fireEvent.click(screen.getByRole("button", { name: "Remove labels" }));
  expect(store.updateFilters).toHaveBeenLastCalledWith("filters", { ...store.filters.filters, labels: [] });
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(store.clearAllFilters).toHaveBeenCalledOnce();
});
