import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { setLanguage } from "@plane/i18n";
import { WorkspaceViewExportModal } from "./export-modal";
const mocks = vi.hoisted(() => ({ send: vi.fn(), close: vi.fn(), toast: vi.fn(), allowed: true }));
vi.hoisted(() => {
  Element.prototype.getAnimations ??= () => [];
});
vi.mock("@/services/project/project-export.service", () => ({
  ProjectExportService: class {
    csvExport = mocks.send;
  },
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "me" } }),
  useUserPermissions: () => ({ allowPermissions: () => mocks.allowed }),
}));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issuesFilter: {
      getIssueFilters: () => ({ richFilters: { priority__in: "high" }, displayFilters: { sub_issue: false } }),
    },
  }),
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
beforeEach(async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.clearAllMocks();
  mocks.allowed = true;
  await setLanguage("zh-CN");
});
it("selects a format, submits the current view scope once and closes on success", async () => {
  let finish!: () => void;
  mocks.send.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  render(
    <MemoryRouter>
      <WorkspaceViewExportModal open workspaceSlug="workspace" viewId="assigned" onClose={mocks.close} />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("combobox"));
  const excel = await screen.findByRole("option", { name: "Excel" });
  fireEvent.pointerDown(excel);
  fireEvent.click(excel);
  await waitFor(() => expect(screen.getByRole("combobox").textContent).toContain("Excel"));
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  expect(mocks.send).toHaveBeenCalledWith(
    "workspace",
    expect.objectContaining({
      provider: "xlsx",
      project: [],
      rich_filters: {
        and: [
          { priority__in: "high" },
          { is_archived__exact: false, is_draft__exact: false },
          { parent_id__isnull: true },
          { assignee_id__in: "me" },
        ],
      },
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "继续" }));
  expect(mocks.send).toHaveBeenCalledOnce();
  await act(() => {
    finish();
  });
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
});
it("keeps the dialog open and allows retry on failure", async () => {
  mocks.send.mockRejectedValue(new Error("network"));
  render(
    <MemoryRouter>
      <WorkspaceViewExportModal open workspaceSlug="workspace" viewId="all-issues" onClose={mocks.close} />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: "继续" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(mocks.close).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "继续" }).hasAttribute("disabled")).toBe(false);
});
it("prevents guests from submitting exports", async () => {
  mocks.allowed = false;
  render(
    <MemoryRouter>
      <WorkspaceViewExportModal open workspaceSlug="workspace" viewId="all-issues" onClose={mocks.close} />
    </MemoryRouter>
  );
  const button = await screen.findByRole("button", { name: "继续" });
  fireEvent.click(button);
  expect(mocks.send).not.toHaveBeenCalled();
});
