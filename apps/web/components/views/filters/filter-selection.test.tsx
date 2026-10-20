import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { EViewAccess } from "@plane/types";
import { shouldFilterView } from "@plane/utils";
import type { IProjectView } from "@plane/types";
import { ViewFiltersDropdown } from "./filter-selection";

vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));

it("marks applied access filters and toggles the selected access without losing other filters", async () => {
  await setLanguage("zh-CN");
  const update = vi.fn();
  render(
    <ViewFiltersDropdown
      filters={{
        searchQuery: "",
        sortKey: "name",
        sortBy: "asc",
        filters: { favorites: true, view_type: [EViewAccess.PRIVATE] },
      }}
      handleFiltersUpdate={update}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "筛选" }));
  await screen.findByText("视图类型");
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.keyDown(screen.getByText("视图类型").closest('[role="button"]')!, { key: "ArrowRight" });
  expect(await screen.findByRole("textbox")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "私有" } });
  expect(screen.queryByRole("button", { name: "公开" })).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: "私有" }));
  expect(update).toHaveBeenCalledWith("filters", { favorites: true, view_type: [] });
});

it("combines access and creator conditions regardless of filter insertion order", () => {
  const view = { access: EViewAccess.PUBLIC, created_by: "alice", is_favorite: true } as IProjectView;
  expect(shouldFilterView(view, { owned_by: ["bob"], view_type: [EViewAccess.PUBLIC] })).toBe(false);
  expect(shouldFilterView(view, { view_type: [EViewAccess.PUBLIC], owned_by: ["bob"] })).toBe(false);
  expect(shouldFilterView(view, { owned_by: ["alice"], view_type: [EViewAccess.PUBLIC] })).toBe(true);
});
