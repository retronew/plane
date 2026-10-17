import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, expect, it, vi } from "vitest";
import { useWorkItemProperties } from "./use-issue-properties";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  values: vi.fn(),
  updateValues: vi.fn(),
  activities: vi.fn(),
  issue: { type_id: "bug" },
}));
vi.mock("@/services/project/custom-properties.service", () => ({
  CustomPropertiesService: class {
    list = mocks.list;
    values = mocks.values;
    updateValues = mocks.updateValues;
  },
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueById: () => mocks.issue }, fetchActivities: mocks.activities }),
}));
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
    {children}
  </SWRConfig>
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.issue.type_id = "bug";
  mocks.list.mockImplementation(async (_w, _p, type) => ({
    results: [{ id: type, is_active: true, effective_is_active: true, sort_order: 0 }],
    count: 1,
    can_manage: false,
  }));
  mocks.values.mockResolvedValue({ values: { a: "original", b: 0 } });
  mocks.updateValues.mockImplementation(async (_w, _p, _i, patch) => ({ values: patch }));
});

it("refetches effective bindings after a work item type changes", async () => {
  const { result, rerender } = renderHook(() => useWorkItemProperties("p", "w", "i"), { wrapper });
  await waitFor(() => expect(result.current.properties[0]?.id).toBe("bug"));
  mocks.issue.type_id = "task";
  rerender();
  await waitFor(() => expect(result.current.properties[0]?.id).toBe("task"));
  expect(mocks.list).toHaveBeenCalledWith("w", "p", "task");
});

it("merges independent saves and leaves cached values intact on a failed save", async () => {
  const { result } = renderHook(() => useWorkItemProperties("p", "w", "i"), { wrapper });
  await waitFor(() => expect(result.current.values.a).toBe("original"));
  await act(async () => {
    await Promise.all([result.current.save({ a: "new" }), result.current.save({ b: null })]);
  });
  expect(result.current.values).toEqual({ a: "new", b: null });
  mocks.updateValues.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await expect(result.current.save({ a: "retry me" })).rejects.toThrow("offline");
  });
  expect(result.current.values.a).toBe("new");
});

it("uses canonical server values for submitted keys without replacing other fields", async () => {
  const { result } = renderHook(() => useWorkItemProperties("p", "w", "i"), { wrapper });
  await waitFor(() => expect(result.current.values.a).toBe("original"));
  mocks.updateValues.mockResolvedValueOnce({ values: { a: "canonical", b: 999 } });
  await act(async () => {
    await result.current.save({ a: "raw" });
  });
  expect(result.current.values).toEqual({ a: "canonical", b: 0 });
});
