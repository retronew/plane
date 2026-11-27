import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import { WorkItemFilterStore } from "@plane/shared-state";
import { WorkItemFiltersToggle } from "../filters-toggle";
import { WorkItemFiltersHOC } from "./base";
let store: WorkItemFilterStore;
vi.mock("@/hooks/store/work-item-filters/use-work-item-filters", () => ({ useWorkItemFilters: () => store }));
vi.mock("@/hooks/work-item-filters/use-work-item-filters-config", () => ({
  useWorkItemFiltersConfig: () => ({ areAllConfigsInitialized: true, configs: [] }),
}));
vi.mock("@/components/rich-filters/filters-toggle", () => ({
  FiltersToggle: ({ filter }: { filter?: { id: string } }) => (
    <div data-testid="toggle-filter-id">{filter?.id ?? "none"}</div>
  ),
}));
beforeEach(() => {
  store = new WorkItemFilterStore();
});
function Root({ id, showOnMount }: { id: string; showOnMount?: boolean }) {
  return (
    <WorkItemFiltersHOC
      entityType={EIssuesStoreType.PROJECT}
      entityId={id}
      workspaceSlug="workspace"
      projectId={id}
      filtersToShowByLayout={[]}
      initialWorkItemFilters={{ richFilters: {}, displayFilters: {}, displayProperties: {}, kanbanFilters: undefined }}
      updateFilters={() => {}}
      showOnMount={showOnMount}
    >
      {({ filter }) => <span>{filter?.id}</span>}
    </WorkItemFiltersHOC>
  );
}
it("keeps the registered instance through StrictMode effect replay and releases it on actual unmount", async () => {
  const { unmount } = render(
    <StrictMode>
      <Root id="one" />
    </StrictMode>
  );
  await act(async () => {
    await Promise.resolve();
  });
  const filter = store.getFilter(EIssuesStoreType.PROJECT, "one");
  expect(filter).toBeDefined();
  expect(screen.getByText(filter!.id)).toBeTruthy();
  expect(filter!.configManager.areConfigsReady).toBe(true);
  unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(store.getFilter(EIssuesStoreType.PROJECT, "one")).toBeUndefined();
});
it("cleans up the old entity while retaining the next entity", async () => {
  const { rerender } = render(<Root id="one" />);
  rerender(<Root id="two" />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(store.getFilter(EIssuesStoreType.PROJECT, "one")).toBeUndefined();
  expect(store.getFilter(EIssuesStoreType.PROJECT, "two")).toBeDefined();
});
it("does not update WorkItemFiltersToggle while rendering WorkItemFilterRoot", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const { rerender } = render(
      <StrictMode>
        <WorkItemFiltersToggle entityType={EIssuesStoreType.PROJECT} entityId="one" />
        <Root id="one" showOnMount />
      </StrictMode>
    );
    await act(async () => {
      await Promise.resolve();
    });
    const filter = store.getFilter(EIssuesStoreType.PROJECT, "one");
    expect(filter).toBeDefined();
    expect(screen.getByTestId("toggle-filter-id").textContent).toBe(filter!.id);

    // Re-render with a fresh updateFilters closure and showOnMount to ensure no render-phase mutation occurs
    rerender(
      <StrictMode>
        <WorkItemFiltersToggle entityType={EIssuesStoreType.PROJECT} entityId="one" />
        <Root id="one" showOnMount />
      </StrictMode>
    );
    await act(async () => {
      await Promise.resolve();
    });

    const renderStateErrors = errorSpy.mock.calls.filter((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("Cannot update a component"))
    );
    expect(renderStateErrors).toHaveLength(0);
  } finally {
    errorSpy.mockRestore();
  }
});
