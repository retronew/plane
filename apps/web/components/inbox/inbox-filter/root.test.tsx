import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { observable, runInAction } from "mobx";
import { setLanguage } from "@plane/i18n";
import { FiltersRoot } from "./root";
import { InboxIssueAppliedFilters } from "./applied-filters/root";
import type { TInboxIssueFilter } from "@plane/types";

const holder = vi.hoisted(() => ({ store: null as any }));
vi.mock("@/hooks/store/use-project-inbox", () => ({ useProjectInbox: () => holder.store }));
vi.mock("@/hooks/use-window-size", () => ({ default: () => [1400, 900] }));
vi.mock("@/hooks/store/use-label", () => ({
  useLabel: () => ({ projectLabels: [{ id: "label", name: "Product", color: "#3b82f6" }] }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({ useProjectState: () => ({ getStateById: () => undefined }) }));
vi.mock("@/hooks/store/use-member", () => ({
  useMember: () => ({
    project: { projectMemberIds: ["ada"] },
    getUserDetails: () => ({ id: "ada", display_name: "Ada", avatar_url: null }),
    workspace: { getWorkspaceMemberDetails: () => ({ member: { display_name: "Ada", avatar_url: null } }) },
  }),
}));
vi.mock("@/components/core/filters/date-filter-modal", () => ({ DateFilterModal: () => null }));
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
  holder.store = observable(
    {
      currentTab: "open",
      inboxFilters: { status: [-2] } as Partial<TInboxIssueFilter>,
      inboxSorting: { order_by: "issue__created_at", sort_by: "desc" },
      loader: undefined,
      inboxIssuePaginationInfo: { total_results: 2 },
      get getAppliedFiltersCount() {
        return Object.values(this.inboxFilters).reduce((count, values) => count + (values?.length ?? 0), 0);
      },
      handleInboxIssueFilters: vi.fn((key, value) =>
        runInAction(() => {
          holder.store.inboxFilters[key] = value;
        })
      ),
      handleInboxIssueSorting: vi.fn(),
      clearInboxIssueFilters: vi.fn(() =>
        runInAction(() => {
          holder.store.inboxFilters = { status: [-2] };
        })
      ),
    },
    { handleInboxIssueFilters: false, handleInboxIssueSorting: false, clearInboxIssueFilters: false }
  );
});
afterEach(() => vi.unstubAllGlobals());
function setup() {
  render(
    <>
      <FiltersRoot />
      <InboxIssueAppliedFilters />
    </>
  );
}

it("uses the project filter button and page-sized sorting control, with all seven submenus", async () => {
  setup();
  expect(screen.getByRole("button", { name: "Order by" }).getAttribute("data-size")).toBe("md");
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  const items = await Promise.all(
    [/Work item Status/, /Priority/, /Assignees/, /Created By/, /Labels/, /Created date/, /Last updated date/].map(
      (name) => screen.findByRole("menuitem", { name })
    )
  );
  expect(items).toHaveLength(7);
});
it("searches labels, updates chips and preserves the status condition", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Labels" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Search" }), { target: { value: "product" } });
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Product" }));
  expect(holder.store.inboxFilters.labels).toEqual(["label"]);
  expect(holder.store.inboxFilters.status).toEqual([-2]);
  fireEvent.keyDown(screen.getByRole("menuitemcheckbox", { name: "Product" }), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Remove Product" }));
  expect(holder.store.inboxFilters.labels).toEqual([]);
  expect(holder.store.inboxFilters.status).toEqual([-2]);
});
it("replaces relative dates and preserves unrelated filters", async () => {
  runInAction(() => {
    holder.store.inboxFilters.created_at = ["yesterday"];
    holder.store.inboxFilters.labels = ["label"];
  });
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /Created date/ }));
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Last 7 days" }));
  expect(holder.store.inboxFilters.created_at).toEqual(["last_7_days"]);
  expect(holder.store.inboxFilters.labels).toEqual(["label"]);
  expect(holder.store.inboxFilters.status).toEqual([-2]);
});

it("does not deselect the last required Intake status", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /Work item Status/ }));
  const selected = await screen.findByRole("menuitemcheckbox", { checked: true });
  fireEvent.click(selected);
  expect(holder.store.handleInboxIssueFilters).not.toHaveBeenCalled();
});
it("hides stale result counts while the filtered server response is loading", () => {
  runInAction(() => {
    holder.store.loader = "filter-loading";
  });
  setup();
  expect(screen.queryByText("2")).toBeNull();
});

it("shows a truthful server result count with the full tooltip and clears through one action", async () => {
  setup();
  const badge = screen.getByText("2").closest("[data-base-ui-tooltip-trigger]")!;
  fireEvent.mouseEnter(badge);
  fireEvent.mouseMove(badge);
  expect(await screen.findByRole("tooltip")).toHaveProperty(
    "textContent",
    "2 Intake work items match the applied filters."
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(holder.store.clearInboxIssueFilters).toHaveBeenCalledOnce();
});
