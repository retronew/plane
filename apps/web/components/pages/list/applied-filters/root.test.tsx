import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PageAppliedFiltersList } from "./root";

vi.mock("@/hooks/store/use-label", () => ({
  useLabel: () => ({ getProjectLabels: () => [{ id: "label-1", name: "Product", color: "#3b82f6" }] }),
}));
vi.mock("@plane/i18n", () => ({
  getCurrentLanguage: () => "en",
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/common/applied-filters/date", () => ({ AppliedDateFilters: () => null }));
vi.mock("@/components/project/applied-filters/members", () => ({ AppliedMembersFilters: () => null }));

it("renders translated filter groups and delegates removal and clear all", () => {
  const remove = vi.fn();
  const clear = vi.fn();
  render(
    <PageAppliedFiltersList
      projectId="project"
      appliedFilters={{ favorites: true, created_by: ["alice"], created_at: ["1_weeks;before;fromnow"] }}
      handleRemoveFilter={remove}
      handleClearAllFilters={clear}
      alwaysAllowEditing
    />
  );
  for (const label of ["web.favorites", "web.created_date", "web.created_by"]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  fireEvent.click(screen.getByRole("button", { name: "remove web.created_by" }));
  expect(remove).toHaveBeenCalledWith("created_by", null);
  fireEvent.click(screen.getByRole("button", { name: "common.clear_all" }));
  expect(clear).toHaveBeenCalledOnce();
});

it("shows selected label name and color and removes individual labels", () => {
  const remove = vi.fn();
  render(
    <PageAppliedFiltersList
      projectId="project"
      appliedFilters={{ labels: ["label-1"] }}
      handleRemoveFilter={remove}
      handleClearAllFilters={vi.fn()}
      alwaysAllowEditing
    />
  );
  const chip = screen.getByText("Product").parentElement!;
  expect(chip.className).toContain("bg-layer-3");
  expect(chip.querySelector("span[style]")?.getAttribute("style")).toContain("59, 130, 246");
  fireEvent.click(screen.getByRole("button", { name: "remove Product" }));
  expect(remove).toHaveBeenCalledWith("labels", "label-1");
});

it("uses project chips and compact group chrome for relative and custom dates", () => {
  const remove = vi.fn();
  render(
    <PageAppliedFiltersList
      projectId="project"
      appliedFilters={{ favorites: true, created_at: ["1_weeks;before;fromnow", "2026-10-01;after"] }}
      handleRemoveFilter={remove}
      handleClearAllFilters={vi.fn()}
      alwaysAllowEditing
    />
  );
  const group = screen.getByText("web.created_date").parentElement!;
  expect(group.className).toContain("min-h-7");
  expect(group.className).toContain("border-subtle-1");
  expect(group.className).toContain("bg-layer-2");
  expect(group.querySelectorAll(".bg-layer-3")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "common.clear_all" }).getAttribute("data-variant")).toBe("secondary");
  fireEvent.click(group.querySelector("button")!);
  expect(remove).toHaveBeenCalledWith("created_at", "1_weeks;before;fromnow");
});

it("hides the applied filter row when no active conditions remain", () => {
  const { container } = render(
    <PageAppliedFiltersList
      projectId="project"
      appliedFilters={{ favorites: false, created_by: [], created_at: [] }}
      handleRemoveFilter={vi.fn()}
      handleClearAllFilters={vi.fn()}
      alwaysAllowEditing
    />
  );
  expect(container.childElementCount).toBe(0);
});
