import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { EIssuesStoreType } from "@plane/types";
import { EIssueFilterType } from "@plane/constants";
import { useIssuesActions } from "./use-issues-actions";

const mocks = vi.hoisted(() => ({
  params: {
    workspaceSlug: "first",
    projectId: "p",
    viewId: "v1",
    moduleId: "m",
    userId: "u",
    globalViewId: "g",
    cycleId: "c",
  },
  issues: {
    fetchIssues: vi.fn(),
    fetchNextIssues: vi.fn(),
    quickAddIssue: vi.fn(),
    removeIssue: vi.fn(),
    restoreIssue: vi.fn(),
  },
  issuesFilter: { updateFilters: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useParams: () => mocks.params }));
vi.mock("./store/use-issues", () => ({ useIssues: () => mocks }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.params.workspaceSlug = "first";
  mocks.params.viewId = "v1";
});
it.each([
  EIssuesStoreType.PROJECT,
  EIssuesStoreType.EPIC,
  EIssuesStoreType.CYCLE,
  EIssuesStoreType.MODULE,
  EIssuesStoreType.PROFILE,
  EIssuesStoreType.PROJECT_VIEW,
  EIssuesStoreType.ARCHIVED,
  EIssuesStoreType.GLOBAL,
])("refreshes pagination when the store method changes for %s", async (storeType) => {
  const { result, rerender } = renderHook(() => useIssuesActions(storeType));
  const previous = result.current.fetchNextIssues;
  const replacement = vi.fn();
  mocks.issues.fetchNextIssues = replacement;
  rerender();
  expect(result.current.fetchNextIssues).not.toBe(previous);
  await result.current.fetchNextIssues("group", "sub");
  expect(replacement).toHaveBeenCalled();
});
it("uses the latest view ID for pagination", async () => {
  const { result, rerender } = renderHook(() => useIssuesActions(EIssuesStoreType.PROJECT_VIEW));
  mocks.params.viewId = "v2";
  rerender();
  await result.current.fetchNextIssues();
  expect(mocks.issues.fetchNextIssues).toHaveBeenLastCalledWith("first", "p", "v2", undefined, undefined);
});
it("refreshes the module quick add action independently", async () => {
  const { result, rerender } = renderHook(() => useIssuesActions(EIssuesStoreType.MODULE));
  const previous = result.current.quickAddIssue;
  mocks.issues.quickAddIssue = vi.fn();
  rerender();
  expect(result.current.quickAddIssue).not.toBe(previous);
});
it("uses the latest workspace for archived operations and module filters", async () => {
  const archived = renderHook(() => useIssuesActions(EIssuesStoreType.ARCHIVED));
  const module = renderHook(() => useIssuesActions(EIssuesStoreType.MODULE));
  mocks.params.workspaceSlug = "second";
  archived.rerender();
  module.rerender();
  await archived.result.current.removeIssue("p", "i");
  await archived.result.current.restoreIssue?.("p", "i");
  await archived.result.current.updateFilters("p", EIssueFilterType.DISPLAY_FILTERS, {});
  await module.result.current.updateFilters("p", EIssueFilterType.DISPLAY_FILTERS, {});
  expect(mocks.issues.removeIssue).toHaveBeenCalledWith("second", "p", "i");
  expect(mocks.issues.restoreIssue).toHaveBeenCalledWith("second", "p", "i");
  expect(mocks.issuesFilter.updateFilters).toHaveBeenCalledWith("second", "p", EIssueFilterType.DISPLAY_FILTERS, {});
  expect(mocks.issuesFilter.updateFilters).toHaveBeenCalledWith(
    "second",
    "p",
    EIssueFilterType.DISPLAY_FILTERS,
    {},
    "m"
  );
});
