import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import { ModuleFiltersDropdown } from "./root";

vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/components/core/filters/date-filter-modal", () => ({ DateFilterModal: () => null }));

beforeEach(async () => {
  await setLanguage("zh-CN");
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
afterEach(async () => {
  await setLanguage("en");
  vi.unstubAllGlobals();
});

it("shows field rows before opening values and preserves selected status when toggling", async () => {
  const update = vi.fn();
  render(
    <ModuleFiltersDropdown
      displayFilters={{}}
      filters={{ status: ["planned"] }}
      handleDisplayFiltersUpdate={vi.fn()}
      handleFiltersUpdate={update}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "筛选" }));
  const status = await screen.findByRole("button", { name: "状态" });
  expect(screen.queryByRole("button", { name: "已计划" })).toBeNull();
  fireEvent.keyDown(status, { key: "ArrowRight" });
  const planned = await screen.findByRole("button", { name: "已计划" });
  expect(planned.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(planned);
  expect(update).toHaveBeenCalledExactlyOnceWith("status", "planned");
});

it("searches translated field names and hides status and favorites in the archive", async () => {
  render(
    <ModuleFiltersDropdown
      isArchived
      displayFilters={{}}
      filters={{}}
      handleDisplayFiltersUpdate={vi.fn()}
      handleFiltersUpdate={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "筛选" }));
  await screen.findByRole("button", { name: "负责人" });
  expect(screen.queryByRole("button", { name: "状态" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "负责人" } });
  expect(screen.getByRole("button", { name: "负责人" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "成员" })).toBeNull();
});

it("uses the shared active trigger and keeps favorites search free of a false empty state", async () => {
  render(
    <ModuleFiltersDropdown
      isFiltersApplied
      displayFilters={{ favorites: true }}
      filters={{}}
      handleDisplayFiltersUpdate={vi.fn()}
      handleFiltersUpdate={vi.fn()}
    />
  );
  const trigger = screen.getByRole("button", { name: "筛选" });
  expect(trigger.className).toContain("border-accent-strong!");
  fireEvent.click(trigger);
  const favorite = await screen.findByRole("button", { name: "收藏" });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: favorite.textContent } });
  expect(screen.getByRole("button", { name: "收藏" })).toBeTruthy();
  expect(screen.queryByText("未找到匹配结果")).toBeNull();
});
