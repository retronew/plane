import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { setLanguage } from "@plane/i18n";
import { CycleExportModal, ScopedWorkItemExportModal } from "./export-modal";

const mocks = vi.hoisted(() => ({ send: vi.fn(), close: vi.fn(), toast: vi.fn(), allowed: true }));
vi.hoisted(() => {
  Element.prototype.getAnimations ??= () => [];
});
vi.mock("@/services/project/project-export.service", () => ({
  ProjectExportService: class {
    csvExport = mocks.send;
  },
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => mocks.allowed }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.allowed = true;
  mocks.send.mockResolvedValue({});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  await setLanguage("zh-CN");
});
it.each(["module", "cycle"] as const)("exports only the selected %s's work items", async (entityType) => {
  render(
    <MemoryRouter>
      <ScopedWorkItemExportModal
        open
        workspaceSlug="workspace"
        projectId="project"
        entityType={entityType}
        entityId="selected"
        entityName="Example"
        onClose={mocks.close}
      />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: "开始导出" }));
  await waitFor(() =>
    expect(mocks.send).toHaveBeenCalledWith("workspace", {
      provider: "csv",
      project: ["project"],
      multiple: false,
      rich_filters: { [`${entityType}_id__in`]: "selected" },
    })
  );
  await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
});
it("exports the selected view's saved conditions", async () => {
  const richFilters = { and: [{ priority__in: "high" }] };
  render(
    <MemoryRouter>
      <ScopedWorkItemExportModal
        open
        workspaceSlug="workspace"
        projectId="project"
        entityType="view"
        entityId="view"
        entityName="View"
        richFilters={richFilters}
        onClose={mocks.close}
      />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: "开始导出" }));
  await waitFor(() =>
    expect(mocks.send).toHaveBeenCalledWith("workspace", {
      provider: "csv",
      project: ["project"],
      multiple: false,
      rich_filters: richFilters,
    })
  );
});
it("preserves the cycle export API and blocks guests", async () => {
  mocks.allowed = false;
  render(
    <MemoryRouter>
      <CycleExportModal
        open
        workspaceSlug="workspace"
        projectId="project"
        cycleId="cycle"
        cycleName="Cycle"
        onClose={mocks.close}
      />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: "开始导出" }));
  expect(mocks.send).not.toHaveBeenCalled();
});
it("keeps a failed module export open for retry", async () => {
  mocks.send.mockRejectedValue(new Error("network"));
  render(
    <MemoryRouter>
      <ScopedWorkItemExportModal
        open
        workspaceSlug="workspace"
        projectId="project"
        entityType="module"
        entityId="module"
        entityName="Module"
        onClose={mocks.close}
      />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: "开始导出" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(mocks.close).not.toHaveBeenCalled();
});
