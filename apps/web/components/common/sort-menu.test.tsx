import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "@plane/i18n";
import type { TProjectOrderByOptions, TModuleOrderByOptions } from "@plane/types";
import { ProjectDisplayMenu } from "@/components/project/dropdowns/display";
import { ProjectOrderByDropdown } from "@/components/project/dropdowns/order-by";
import { ModuleOrderByDropdown } from "@/components/modules/dropdowns/order-by";
import { PageOrderByDropdown } from "@/components/pages/list/order-by";
import { ViewOrderByDropdown } from "@/components/views/filters/order-by";
import { SubIssueDisplayFilters } from "@/components/issues/issue-detail-widgets/sub-issues/display-filters";
import { InboxIssueOrderByDropdown } from "@/components/inbox/inbox-filter/sorting/order-by";
const inbox = vi.hoisted(() => ({
  inboxSorting: { order_by: "created_at", sort_by: "desc" },
  handleInboxIssueSorting: vi.fn(),
}));
vi.mock("@/hooks/store/use-project-inbox", () => ({ useProjectInbox: () => inbox }));
vi.mock("@/hooks/use-window-size", () => ({ default: () => [1440, 900] }));
beforeEach(async () => {
  vi.clearAllMocks();
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
async function open() {
  fireEvent.click(screen.getAllByRole("button")[0]);
  return screen.findByRole("menuitem", { name: /排序字段/ });
}
async function chooseDirection() {
  fireEvent.click(screen.getByRole("menuitem", { name: /排序方向/ }));
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "升序" }));
}
for (const source of ["project display", "project order", "module"] as const) {
  it(`${source} separates the two controls and preserves descending when choosing a field`, async () => {
    const change = vi.fn();
    function Fixture() {
      const [value, setValue] = useState("-created_at");
      const update = (next: string) => {
        setValue(next);
        change(next);
      };
      if (source === "project display")
        return <ProjectDisplayMenu value={value as TProjectOrderByOptions} onChange={update} />;
      if (source === "project order")
        return <ProjectOrderByDropdown value={value as TProjectOrderByOptions} onChange={update} />;
      return <ModuleOrderByDropdown value={value as TModuleOrderByOptions} onChange={update} />;
    }
    render(<Fixture />);
    const field = await open();
    const direction = screen.getByRole("menuitem", { name: /排序方向/ });
    expect(field.parentElement).toBe(direction.parentElement);
    fireEvent.click(field);
    const option = await screen.findByRole("menuitemradio", { name: /名称/ });
    fireEvent.click(option);
    await waitFor(() => expect(change).toHaveBeenLastCalledWith("-name"));
    await chooseDirection();
    expect(change).toHaveBeenLastCalledWith("name");
  });
}
for (const source of ["project", "module"] as const) {
  it(`${source} never creates a negative manual sort key`, async () => {
    const change = vi.fn();
    render(
      source === "project" ? (
        <ProjectDisplayMenu value="-name" onChange={change} />
      ) : (
        <ModuleOrderByDropdown value="-name" onChange={change} />
      )
    );
    fireEvent.click(await open());
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /手动/ }));
    expect(change).toHaveBeenCalledExactlyOnceWith("sort_order");
  });
}
it("disables direction for manual ordering", async () => {
  render(<ProjectDisplayMenu value="sort_order" onChange={vi.fn()} />);
  await open();
  expect(screen.getByRole("menuitem", { name: /排序方向/ }).getAttribute("aria-disabled")).toBe("true");
});
for (const source of ["pages", "views"] as const) {
  it(`${source} updates the field independently from direction`, async () => {
    const change = vi.fn();
    render(
      source === "pages" ? (
        <PageOrderByDropdown sortKey="created_at" sortBy="desc" onChange={change} />
      ) : (
        <ViewOrderByDropdown sortKey="created_at" sortBy="desc" onChange={change} />
      )
    );
    fireEvent.click(await open());
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /名称/ }));
    expect(change).toHaveBeenLastCalledWith({ key: "name" });
    await chooseDirection();
    expect(change).toHaveBeenLastCalledWith({ order: "asc" });
  });
}
it("inbox updates its existing separate sort keys", async () => {
  render(<InboxIssueOrderByDropdown />);
  await open();
  await chooseDirection();
  expect(inbox.handleInboxIssueSorting).toHaveBeenCalledExactlyOnceWith("sort_by", "asc");
});

it("sub-work-item display menus use the shared field and direction controls", async () => {
  const change = vi.fn();
  render(
    <SubIssueDisplayFilters
      displayProperties={{ key: true }}
      displayFilters={{ order_by: "-created_at" }}
      handleDisplayFiltersUpdate={change}
      handleDisplayPropertiesUpdate={vi.fn()}
      layoutDisplayFiltersOptions={{
        display_properties: ["key"],
        display_filters: { order_by: ["-created_at"] },
        extra_options: { access: false, values: [] },
      }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "显示" }));
  await screen.findByRole("menuitem", { name: /排序字段/ });
  await chooseDirection();
  expect(change).toHaveBeenCalledExactlyOnceWith({ order_by: "created_at" });
});
it("undefined legacy order values use a valid field when changing direction", async () => {
  const change = vi.fn();
  render(<ModuleOrderByDropdown value={undefined} onChange={change} />);
  await open();
  fireEvent.click(screen.getByRole("menuitem", { name: /排序方向/ }));
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "降序" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("-created_at");
});
