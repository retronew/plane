import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import { WorkItemFilterStore } from "@plane/shared-state";
import { WorkItemFiltersHOC } from "./base";
let store: WorkItemFilterStore;
vi.mock("@/hooks/store/work-item-filters/use-work-item-filters", () => ({ useWorkItemFilters: () => store }));
vi.mock("@/hooks/work-item-filters/use-work-item-filters-config", () => ({
  useWorkItemFiltersConfig: () => ({ areAllConfigsInitialized: true, configs: [] }),
}));
beforeEach(() => {
  store = new WorkItemFilterStore();
});
function Root({ id }: { id: string }) {
  return (
    <WorkItemFiltersHOC
      entityType={EIssuesStoreType.PROJECT}
      entityId={id}
      workspaceSlug="workspace"
      projectId={id}
      filtersToShowByLayout={[]}
      initialWorkItemFilters={{ richFilters: {}, displayFilters: {}, displayProperties: {}, kanbanFilters: undefined }}
      updateFilters={() => {}}
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
