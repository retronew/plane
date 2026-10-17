import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import type { TPartialProject } from "@plane/types";
import { SidebarProjectQuickActions } from "./project-quick-actions";

const mocks = vi.hoisted(() => ({
  role: 20,
  favorites: {} as Record<string, unknown>,
  add: vi.fn(),
  remove: vi.fn(),
  copy: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ addProjectToFavorites: mocks.add }) }));
vi.mock("@/hooks/store/use-favorite", () => ({
  useFavorite: () => ({ entityMap: mocks.favorites, removeFavoriteEntity: mocks.remove }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: (roles: number[]) => roles.includes(mocks.role) }),
}));
vi.mock("@/components/project/publish-project/modal", () => ({
  PublishProjectModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <dialog open aria-label="publish" /> : null),
}));
vi.mock("@/components/project/archive-restore-modal", () => ({
  ArchiveRestoreProjectModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <dialog open aria-label="archive" /> : null,
}));
vi.mock("@/components/project/leave-project-modal", () => ({
  LeaveProjectModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <dialog open aria-label="leave" /> : null),
}));

const project: TPartialProject = {
  id: "project-1",
  name: "Example",
  identifier: "EX",
  workspace: "workspace-1",
  member_role: 20,
  sort_order: 1,
  archived_at: null,
  logo_props: { in_use: "emoji", emoji: { value: "128640" } },
  cycle_view: true,
  module_view: true,
  page_view: true,
  project_updates_view: false,
  issue_views_view: true,
  inbox_view: true,
};
function Fixture({ memberRole = 20 }: { memberRole?: number | null }) {
  return (
    <Menu>
      <MenuTrigger>Actions</MenuTrigger>
      <SidebarProjectQuickActions
        workspaceSlug="workspace"
        project={{ ...project, member_role: memberRole as TPartialProject["member_role"] }}
        onCopyLink={mocks.copy}
      />
    </Menu>
  );
}
async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  await screen.findByRole("menu");
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = 20;
  mocks.favorites = {};
  mocks.add.mockResolvedValue({});
  mocks.remove.mockResolvedValue(undefined);
});
it("provides the seven online actions in order and separates project management", async () => {
  render(<Fixture />);
  await openMenu();
  expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual([
    "settings",
    "copy_link",
    "add_to_favorites",
    "publish_project",
    "web.project_quick_actions.open_archives",
    "web.project_quick_actions.archive_project",
    "leave_project",
  ]);
  expect(screen.getByRole("separator")).toBeTruthy();
  fireEvent.click(screen.getByRole("menuitem", { name: "settings" }));
  expect(mocks.push).toHaveBeenCalledWith("/workspace/settings/projects/project-1/");
});
it("links to archived work items rather than archiving the project directly", async () => {
  render(<Fixture />);
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "web.project_quick_actions.open_archives" }));
  expect(mocks.push).toHaveBeenCalledWith("/workspace/projects/project-1/archives/issues/");
});
it.each([
  ["publish_project", "publish"],
  ["web.project_quick_actions.archive_project", "archive"],
  ["leave_project", "leave"],
])("opens the existing %s dialog before any operation", async (action, dialog) => {
  render(<Fixture />);
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: action }));
  expect(screen.getByRole("dialog", { name: dialog })).toBeTruthy();
  expect(mocks.push).not.toHaveBeenCalled();
});
it("adds a favorite and reveals the favorites section", async () => {
  render(<Fixture />);
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "add_to_favorites" }));
  await waitFor(() => expect(mocks.add).toHaveBeenCalledWith("workspace", "project-1"));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success" })));
  expect(localStorage.getItem("is_favorite_menu_open")).toBe("true");
});
it("uses the favorites registry when lite project data has no is_favorite flag", async () => {
  mocks.favorites[project.id] = { id: "favorite-1" };
  render(<Fixture />);
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "remove_from_favorites" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("workspace", "project-1"));
  expect(mocks.add).not.toHaveBeenCalled();
});
it("reports failed favorite saves", async () => {
  mocks.add.mockRejectedValueOnce(new Error("offline"));
  render(<Fixture />);
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "add_to_favorites" }));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "couldnt_add_the_project_to_favorites" })
    )
  );
});
it.each([15, 5])("allows role %i to leave while hiding admin actions", async (role) => {
  mocks.role = role;
  render(<Fixture memberRole={role} />);
  await openMenu();
  expect(screen.getByRole("menuitem", { name: "leave_project" })).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "publish_project" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "web.project_quick_actions.archive_project" })).toBeNull();
});
it("does not offer leaving to a user who has not joined", async () => {
  mocks.role = 0;
  render(<Fixture memberRole={null} />);
  await openMenu();
  expect(screen.queryByRole("menuitem", { name: "leave_project" })).toBeNull();
  expect(screen.queryByRole("separator")).toBeNull();
});
