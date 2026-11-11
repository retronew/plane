import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ICycle, IModule } from "@plane/types";
import { useCycleMenuItems, useModuleMenuItems } from "./quick-actions-helper";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
const props = {
  isEditingAllowed: true,
  workspaceSlug: "demo",
  projectId: "project",
  handleEdit: vi.fn(),
  handleArchive: vi.fn(),
  handleRestore: vi.fn(),
  handleDelete: vi.fn(),
  handleCopyLink: vi.fn(),
  handleOpenInNewTab: vi.fn(),
};
it.each(["current", "upcoming", "completed"])("provides a tooltip reason only for unarchivable %s cycles", (status) => {
  const { result } = renderHook(() =>
    useCycleMenuItems({ ...props, cycleId: "cycle", cycleDetails: { status } as ICycle })
  );
  const archive = result.current.items.find((item) => item.key === "archive");
  expect(archive?.description).toBeUndefined();
  expect(archive?.disabled).toBe(status !== "completed");
  expect(archive?.disabledReason).toBe(
    status === "completed" ? undefined : "web.only_completed_cycles_can_be_archived"
  );
});
it.each(["backlog", "in-progress", "completed", "cancelled"])(
  "provides a tooltip reason only for unarchivable %s modules",
  (status) => {
    const { result } = renderHook(() =>
      useModuleMenuItems({ ...props, moduleId: "module", moduleDetails: { status } as IModule })
    );
    const archive = result.current.items.find((item) => item.key === "archive");
    const allowed = ["completed", "cancelled"].includes(status);
    expect(archive?.description).toBeUndefined();
    expect(archive?.disabled).toBe(!allowed);
    expect(archive?.disabledReason).toBe(
      allowed ? undefined : "web.only_completed_or_cancelled_modules_can_be_archived"
    );
  }
);
it.each([true, false])(
  "hides archive for archived entities regardless of editing permission %s",
  (isEditingAllowed) => {
    const { result } = renderHook(() =>
      useModuleMenuItems({
        ...props,
        isEditingAllowed,
        moduleId: "module",
        moduleDetails: { status: "completed", archived_at: "2026-11-10" } as IModule,
      })
    );
    expect(result.current.items.some((item) => item.key === "archive")).toBe(false);
  }
);
it("hides archive for users without editing permission", () => {
  const { result } = renderHook(() =>
    useModuleMenuItems({
      ...props,
      isEditingAllowed: false,
      moduleId: "module",
      moduleDetails: { status: "completed" } as IModule,
    })
  );
  expect(result.current.items.some((item) => item.key === "archive")).toBe(false);
});
