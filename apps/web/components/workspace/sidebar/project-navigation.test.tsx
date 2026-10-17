import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import type { IPartialProject } from "@plane/types";
import { ProjectNavigation } from "./project-navigation";
import { useNavigationItems } from "@/components/navigation/use-navigation-items";

const mocks = vi.hoisted(() => ({
  pathname: "/workspace/projects/project-1/overview/",
  role: 20,
  extended: false,
  toggleSidebar: vi.fn(),
  toggleExtended: vi.fn(),
  project: undefined as IPartialProject | undefined,
}));
vi.mock("next/navigation", () => ({ useParams: () => ({}), usePathname: () => mocks.pathname }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@/hooks/store/use-app-theme", () => ({
  useAppTheme: () => ({
    isExtendedProjectSidebarOpened: mocks.extended,
    toggleExtendedProjectSidebar: mocks.toggleExtended,
    toggleSidebar: mocks.toggleSidebar,
  }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getPartialProjectById: () => mocks.project }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: (roles: number[]) => roles.includes(mocks.role) }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({ issue: { getIssueIdByIdentifier: () => undefined, getIssueById: () => undefined } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/workspace/projects/project-1/overview/";
  mocks.role = 20;
  mocks.extended = false;
  mocks.project = {
    id: "project-1",
    name: "Example",
    identifier: "EX",
    workspace: "workspace-1",
    sort_order: 1,
    archived_at: null,
    logo_props: { in_use: "emoji", emoji: { value: "128640" } },
    cycle_view: true,
    module_view: true,
    issue_views_view: true,
    page_view: true,
    project_updates_view: false,
    inbox_view: false,
  };
});
function renderNavigation() {
  return render(
    <MemoryRouter>
      <ProjectNavigation workspaceSlug="workspace" projectId="project-1" />
    </MemoryRouter>
  );
}
it("shows overview first and views between modules and pages with project-scoped destinations", () => {
  renderNavigation();
  expect(screen.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["common.overview", "/workspace/projects/project-1/overview/"],
    ["sidebar.work_items", "/workspace/projects/project-1/issues/"],
    ["sidebar.cycles", "/workspace/projects/project-1/cycles/"],
    ["sidebar.modules", "/workspace/projects/project-1/modules/"],
    ["sidebar.views", "/workspace/projects/project-1/views/"],
    ["sidebar.pages", "/workspace/projects/project-1/pages/"],
  ]);
  expect(screen.getByRole("link", { name: "common.overview" }).firstElementChild?.className).toContain("text-primary");
});
it("hides views when the feature is disabled along with other disabled features", () => {
  Object.assign(mocks.project!, { cycle_view: false, module_view: false, issue_views_view: false, page_view: false });
  renderNavigation();
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "common.overview",
    "sidebar.work_items",
  ]);
});
it("preserves guest access restrictions", () => {
  mocks.role = 5;
  renderNavigation();
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "common.overview",
    "sidebar.work_items",
    "sidebar.views",
    "sidebar.pages",
  ]);
});
it("does not show navigation when project permission is missing", () => {
  mocks.role = 0;
  renderNavigation();
  expect(screen.queryByRole("link")).toBeNull();
});
it("closes the mobile sidebar and extended project list when following a link", () => {
  vi.spyOn(window, "innerWidth", "get").mockReturnValueOnce(375);
  mocks.extended = true;
  renderNavigation();
  fireEvent.click(screen.getByRole("link", { name: "sidebar.views" }));
  expect(mocks.toggleSidebar).toHaveBeenCalledOnce();
  expect(mocks.toggleExtended).toHaveBeenCalledWith(false);
});
it("marks views active for a view detail route and preserves intake counts", () => {
  mocks.pathname = "/workspace/projects/project-1/views/view-1/";
  Object.assign(mocks.project!, { inbox_view: true, intake_count: 3 });
  renderNavigation();
  expect(screen.getByRole("link", { name: "sidebar.views" }).firstElementChild?.className).toContain("text-primary");
  expect(screen.getByRole("link", { name: "sidebar.intake 3" })).toBeTruthy();
});
it("keeps the tabbed navigation consistent with the sidebar for disabled views", () => {
  mocks.project!.issue_views_view = false;
  function TabsFixture() {
    const items = useNavigationItems({
      workspaceSlug: "workspace",
      projectId: "project-1",
      project: mocks.project,
      allowPermissions: (roles) => roles.some((role) => role === mocks.role),
    });
    return <output>{items.map((item) => item.key).join(",")}</output>;
  }
  render(<TabsFixture />);
  expect(screen.getByRole("status").textContent).toBe("overview,work_items,cycles,modules,pages");
});
