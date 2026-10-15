import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { observable, runInAction } from "mobx";
import type { TProjectGrouping } from "@plane/types";
import type { IProject } from "@plane/types";
import { ProjectLayouts } from "./layouts";
const createProject = vi.fn();
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleCreateProjectModal: createProject }),
}));
vi.mock("@/hooks/use-can-create-project", () => ({ useCanCreateProject: () => true }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: { id: "user" } }) }));
const view = observable({ group_by: "status" as TProjectGrouping });
beforeEach(() =>
  runInAction(() => {
    view.group_by = "status";
  })
);
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key, currentLocale: "en" }) }));
vi.mock("@/components/settings/workspace/configuration/project-fields", () => ({
  useProjectCategories: () => ({
    statuses: [
      { id: "draft", name: "Draft", group: "draft", is_default: true },
      { id: "active", name: "Active", group: "execution" },
    ],
  }),
}));
vi.mock("@/hooks/store/use-project-filter", () => ({
  useProjectFilter: () => ({ currentWorkspaceDisplayFilters: view }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("./timeline", () => ({ ProjectTimeline: () => null }));
vi.mock("./card", () => ({
  ProjectCard: ({ project, compact }: { project: IProject; compact?: boolean }) => (
    <div data-testid={project.id} data-compact={compact}>
      {project.name}
    </div>
  ),
}));
const projects = [
  { id: "p1", name: "One", status: "draft" },
  { id: "p2", name: "Two", status: "active" },
] as IProject[];
it("keeps board headers static and every project visible", () => {
  render(<ProjectLayouts projects={projects} layout="board" />);
  expect(screen.queryByRole("button", { name: /Draft/ })).toBeNull();
  fireEvent.click(screen.getByText("Draft"));
  expect(screen.getByTestId("p1")).toBeTruthy();
  expect(screen.getByTestId("p2")).toBeTruthy();
});
it("keeps list collapse independent of board headers", () => {
  render(<ProjectLayouts projects={projects} layout="list" />);
  fireEvent.click(screen.getByRole("button", { name: /Draft/ }));
  expect(screen.queryByTestId("p1")).toBeNull();
  expect(screen.getByTestId("p2")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Draft/ }));
  expect(screen.getByTestId("p1")).toBeTruthy();
});

it("updates grouped content immediately when the display menu changes grouping", () => {
  render(<ProjectLayouts projects={projects} layout="board" />);
  expect(screen.getByText("Draft")).toBeTruthy();
  act(() =>
    runInAction(() => {
      view.group_by = "priority";
    })
  );
  expect(screen.queryByRole("button", { name: /Draft/ })).toBeNull();
  expect(screen.getByText("web.none")).toBeTruthy();
  expect(screen.getByTestId("p1")).toBeTruthy();
});

it("keeps board headers outside the card scroll viewport so scrolling cannot cover them", () => {
  const { container } = render(<ProjectLayouts projects={projects} layout="board" />);
  const board = container.querySelector('[data-layout-scroll-area="horizontal"]');
  expect(board).toBeTruthy();
  for (const column of container.querySelectorAll("[data-kanban-column]")) {
    const header = column.querySelector("[data-kanban-header]");
    const scrollArea = column.querySelector('[data-layout-scroll-area="vertical"]');
    expect(header?.parentElement).toBe(column);
    expect(scrollArea?.parentElement).toBe(column);
    expect(scrollArea?.contains(header)).toBe(false);
    expect(scrollArea?.querySelector("[data-testid]")).toBeTruthy();
  }
});

it("opens project creation with the clicked column preset without collapsing the column", () => {
  render(<ProjectLayouts projects={projects} layout="board" />);
  fireEvent.click(screen.getAllByRole("button", { name: "workspace_projects.create.label" })[1]);
  expect(createProject).toHaveBeenCalledWith(true, { status: "active" });
  expect(screen.queryByRole("button", { name: /Active/ })).toBeNull();
  expect(screen.getByTestId("p2")).toBeTruthy();
});
