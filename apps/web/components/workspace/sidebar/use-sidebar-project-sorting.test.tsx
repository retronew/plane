import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useSidebarProjectSorting } from "./use-sidebar-project-sorting";

const mocks = vi.hoisted(() => ({ update: vi.fn(), toast: vi.fn() }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({
    joinedProjectIds: ["a", "b", "c"],
    getPartialProjectById: (id: string) => ({ id, sort_order: ["a", "b", "c"].indexOf(id) * 10000 }),
    updateProjectView: mocks.update,
  }),
}));
beforeEach(() => vi.clearAllMocks());

it("persists the visible destination and prevents overlapping saves", async () => {
  let finish!: () => void;
  mocks.update.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const { result } = renderHook(() => useSidebarProjectSorting("workspace", ["a", "b"], "main"));
  const change = {
    id: "a",
    initialIndex: 0,
    index: 1,
    group: result.current.group,
    initialGroup: result.current.group,
  };
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.onSortEnd(change);
  });
  expect(result.current.isSaving).toBe(true);
  expect(mocks.update).toHaveBeenCalledWith("workspace", "a", { sort_order: 15000 });
  await expect(result.current.onSortEnd(change)).rejects.toThrow("being saved");
  await act(async () => {
    finish();
    await pending;
  });
  expect(result.current.isSaving).toBe(false);
  expect(mocks.update).toHaveBeenCalledTimes(1);
});

it("reports persistence failures and rethrows so the provider restores visual order", async () => {
  const error = new Error("offline");
  mocks.update.mockRejectedValue(error);
  const { result } = renderHook(() => useSidebarProjectSorting("workspace", ["a", "b"], "extended"));
  await act(async () => {
    await expect(
      result.current.onSortEnd({
        id: "a",
        initialIndex: 0,
        index: 1,
        group: result.current.group,
        initialGroup: result.current.group,
      })
    ).rejects.toBe(error);
  });
  expect(mocks.toast).toHaveBeenCalledWith({ type: "error", title: "error", message: "something_went_wrong" });
  expect(result.current.isSaving).toBe(false);
});

it("does not save unchanged or cross-workspace moves", async () => {
  const { result } = renderHook(() => useSidebarProjectSorting("workspace", ["a", "b"], "main"));
  await result.current.onSortEnd({
    id: "a",
    initialIndex: 0,
    index: 0,
    group: result.current.group,
    initialGroup: result.current.group,
  });
  await result.current.onSortEnd({ id: "a", initialIndex: 0, index: 1, group: "other", initialGroup: "other" });
  expect(mocks.update).not.toHaveBeenCalled();
});
