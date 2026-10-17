import { useRef } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { ICycle } from "@plane/types";
import { CycleQuickActions } from "./quick-actions";

const mocks = vi.hoisted(() => ({
  role: 20,
  workspaceAllowed: true,
  cycle: { id: "cycle", status: "Current", archived_at: null, is_favorite: false } as unknown as ICycle,
  add: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  copy: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  export: vi.fn(),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/services/project/project-export.service", () => ({
  ProjectExportService: class {
    csvExport = mocks.export;
  },
}));
vi.mock("@plane/utils", async (original) => ({
  ...(await original<object>()),
  copyUrlToClipboard: mocks.copy,
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({
    allowPermissions: (roles: number[], level: EUserPermissionsLevel) =>
      roles.includes(mocks.role) && (level !== EUserPermissionsLevel.WORKSPACE || mocks.workspaceAllowed),
  }),
}));
vi.mock("@/hooks/store/use-cycle", () => ({
  useCycle: () => ({
    getCycleById: () => mocks.cycle,
    addCycleToFavorites: mocks.add,
    removeCycleFromFavorites: mocks.remove,
    restoreCycle: mocks.restore,
  }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("./modal", () => ({
  CycleCreateUpdateModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <dialog open aria-label="edit-cycle" /> : null,
}));
vi.mock("./complete-modal", () => ({
  CycleCompleteModal: ({ open }: { open: boolean }) => (open ? <dialog open aria-label="complete-cycle" /> : null),
}));
vi.mock("./delete-modal", () => ({
  CycleDeleteModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <dialog open aria-label="delete-cycle" /> : null),
}));
vi.mock("./archived-cycles/modal", () => ({
  ArchiveCycleModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <dialog open aria-label="archive-cycle" /> : null),
}));

function Fixture() {
  const parentRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={parentRef} data-testid="cycle-card">
      <CycleQuickActions parentRef={parentRef} workspaceSlug="demo" projectId="project" cycleId="cycle" />
    </div>
  );
}
async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "common.options" }));
  return await screen.findByRole("menu");
}
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.getAnimations ??= () => [];
  localStorage.clear();
  mocks.role = EUserPermissions.ADMIN;
  mocks.workspaceAllowed = true;
  mocks.cycle = { id: "cycle", status: "current", archived_at: null, is_favorite: false } as unknown as ICycle;
  mocks.add.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.copy.mockResolvedValue(undefined);
  mocks.restore.mockResolvedValue(undefined);
  mocks.export.mockResolvedValue(undefined);
});

it.each([EUserPermissions.ADMIN, EUserPermissions.MEMBER])(
  "shows all existing cycle operations plus favorites for role %i without enabling current-cycle archive",
  async (role) => {
    mocks.role = role;
    render(<Fixture />);
    const menu = await openMenu();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual([
      "edit",
      "open_in_new_tab",
      "copy_link",
      "add_to_favorites",
      "project_cycles.complete.action",
      "export",
      "archiveweb.only_completed_cycles_can_be_archived",
      "delete",
    ]);
    const sequence = Array.from(menu.querySelectorAll('[role="menuitem"], [role="separator"]'));
    expect(sequence.map((item) => item.getAttribute("role"))).toEqual([
      "menuitem",
      "menuitem",
      "menuitem",
      "menuitem",
      "menuitem",
      "menuitem",
      "separator",
      "menuitem",
      "menuitem",
    ]);
    const deletion = within(menu).getByRole("menuitem", { name: "delete" });
    expect(deletion.className).toContain("text-danger-primary");
    expect(within(menu).getByRole("menuitem", { name: "edit" }).className).toContain("text-primary");
    const archive = within(menu).getByRole("menuitem", { name: /archive/ });
    expect(archive.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(archive);
    expect(screen.queryByRole("dialog")).toBeNull();
  }
);
afterEach(() => vi.unstubAllGlobals());

it("uses the same grouping, order, and danger color in the card context menu", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  render(<Fixture />);
  fireEvent.contextMenu(screen.getByTestId("cycle-card"), { clientX: 120, clientY: 80 });
  const menu = await screen.findByRole("menu");
  expect(
    Array.from(menu.querySelectorAll('[role="menuitem"], [role="separator"]')).map((item) =>
      item.getAttribute("role") === "separator" ? "separator" : item.textContent
    )
  ).toEqual([
    "edit",
    "open_in_new_tab",
    "copy_link",
    "add_to_favorites",
    "project_cycles.complete.action",
    "export",
    "separator",
    "archiveweb.only_completed_cycles_can_be_archived",
    "delete",
  ]);
  expect(within(menu).getByRole("menuitem", { name: "delete" }).className).toContain("text-danger-primary");
});

it.each([EUserPermissions.GUEST, 0])("keeps role %i read-only", async (role) => {
  mocks.role = role;
  render(<Fixture />);
  const menu = await openMenu();
  expect(
    within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent)
  ).toEqual(["open_in_new_tab", "copy_link"]);
});
it.each([
  ["edit", "edit-cycle"],
  ["delete", "delete-cycle"],
  ["project_cycles.complete.action", "complete-cycle"],
])("opens the existing %s confirmation dialog", async (action, dialog) => {
  render(<Fixture />);
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: action }));
  expect(screen.getByRole("dialog", { name: dialog })).toBeTruthy();
  expect(mocks.restore).not.toHaveBeenCalled();
});
it("offers archive only for completed cycles and preserves the completed-cycle editing restriction", async () => {
  mocks.cycle.status = "completed";
  render(<Fixture />);
  const menu = await openMenu();
  expect(within(menu).queryByRole("menuitem", { name: "edit" })).toBeNull();
  expect(within(menu).queryByRole("menuitem", { name: "delete" })).toBeNull();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "archive" }));
  expect(screen.getByRole("dialog", { name: "archive-cycle" })).toBeTruthy();
});
it("restores archived cycles through the existing store action and hides other mutations", async () => {
  mocks.cycle.archived_at = "2026-10-18T00:00:00Z";
  render(<Fixture />);
  const menu = await openMenu();
  expect(
    within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent)
  ).toEqual(["open_in_new_tab", "copy_link", "export", "restore"]);
  fireEvent.click(within(menu).getByRole("menuitem", { name: "restore" }));
  await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith("demo", "project", "cycle"));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/demo/projects/project/archives/cycles"));
});
it("copies the exact cycle link", async () => {
  render(<Fixture />);
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "copy_link" }));
  await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith("demo/projects/project/cycles/cycle"));
});
it("opens the exact cycle in a new tab", async () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  render(<Fixture />);
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "open_in_new_tab" }));
  expect(open).toHaveBeenCalledWith("/demo/projects/project/cycles/cycle", "_blank", "noopener,noreferrer");
  open.mockRestore();
});
it("adds favorites through the store and reveals the favorite section", async () => {
  render(<Fixture />);
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "add_to_favorites" }));
  await waitFor(() => expect(mocks.add).toHaveBeenCalledWith("demo", "project", "cycle"));
  await waitFor(() => expect(localStorage.getItem("is_favorite_menu_open")).toBe("true"));
});
it("removes an existing favorite", async () => {
  mocks.cycle.is_favorite = true;
  render(<Fixture />);
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "remove_from_favorites" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("demo", "project", "cycle"));
  expect(mocks.add).not.toHaveBeenCalled();
});
it("exports only this cycle after explicit confirmation", async () => {
  render(<Fixture />);
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "export" }));
  expect(mocks.export).not.toHaveBeenCalled();
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "workspace_settings.settings.exports.start_export" }));
  await waitFor(() =>
    expect(mocks.export).toHaveBeenCalledWith("demo", {
      provider: "csv",
      project: ["project"],
      multiple: false,
      rich_filters: { cycle_id__in: "cycle" },
    })
  );
});
it("hides export when project membership does not grant workspace export permission", async () => {
  mocks.workspaceAllowed = false;
  render(<Fixture />);
  const menu = await openMenu();
  expect(within(menu).queryByRole("menuitem", { name: "export" })).toBeNull();
  expect(within(menu).getByRole("menuitem", { name: "edit" })).toBeTruthy();
});
it("keeps export confirmation open and reports failure", async () => {
  mocks.export.mockRejectedValueOnce(new Error("offline"));
  render(<Fixture />);
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "export" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "workspace_settings.settings.exports.start_export" }));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "workspace_settings.settings.exports.modal.toasts.error.message",
      })
    )
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
});
it("reports a failed favorite mutation", async () => {
  mocks.add.mockRejectedValueOnce(new Error("offline"));
  render(<Fixture />);
  const menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "add_to_favorites" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
});
