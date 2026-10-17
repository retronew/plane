import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import useSWR, { SWRConfig } from "swr";
import type { ConfirmDialogProps } from "@plane/blocks/dialog";
import {
  configurationKey,
  workspaceConfigurationService as service,
  type WorkspaceTemplate,
} from "@/services/workspace-configuration.service";
import { ConfigurationManager } from "./manager";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  list: vi.fn(),
  projectList: vi.fn(),
  remove: vi.fn(),
  projectRemove: vi.fn(),
  dialog: { isOpen: false, title: "" },
}));
vi.mock("react-router", () => ({
  useParams: () => ({ workspaceSlug: "w" }),
  useNavigate: () => state.navigate,
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("use-font-face-observer", () => ({ default: () => true }));
vi.mock("@/services/workspace-configuration.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/workspace-configuration.service")>()),
  workspaceConfigurationService: {
    list: state.list,
    listProjectTemplates: state.projectList,
    remove: state.remove,
    removeProjectTemplate: state.projectRemove,
  },
}));
vi.mock("@plane/blocks/dialog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@plane/blocks/dialog")>();
  return {
    ...actual,
    ConfirmDialog: (props: ConfirmDialogProps) => {
      state.dialog = { isOpen: props.isOpen, title: props.title };
      return <actual.ConfirmDialog {...props} />;
    },
  };
});
vi.mock("@plane/blocks/empty-state", () => ({
  EmptyStateCompact: ({
    title,
    description,
    rootClassName,
    assetKey,
  }: {
    title: string;
    description: string;
    rootClassName: string;
    assetKey: string;
  }) => (
    <div data-testid="empty" data-asset={assetKey} className={rootClassName}>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  ),
}));

const template = (id: string, project: string | null, kind: WorkspaceTemplate["kind"]): WorkspaceTemplate => ({
  id,
  project,
  kind,
  name: id,
  short_description: `${id} summary`,
  configuration: {},
  title: id,
  description_html: "",
  priority: "none",
});
const entries = [
  template("Bug report", "p", "work_item"),
  template("Project notes", "p", "page"),
  template("Workspace template", null, "work_item"),
  template("Other project", "other", "page"),
  template("Unsupported project kind", "p", "project"),
];

beforeEach(() => {
  vi.clearAllMocks();
  state.list.mockResolvedValue(entries);
  state.projectList.mockResolvedValue(entries);
  state.remove.mockResolvedValue(undefined);
  state.projectRemove.mockResolvedValue(undefined);
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

function setup(projectId?: string, children?: ReactNode) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <ConfigurationManager projectId={projectId} />
      {children}
    </SWRConfig>
  );
}

it("fetches project templates and strictly excludes workspace, other project and unsupported template rows", async () => {
  setup("p");
  await screen.findByRole("button", { name: "Bug report Bug report summary" });
  expect(state.projectList).toHaveBeenCalledWith("w", "p");
  expect(state.list).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Project notes Project notes summary" })).toBeTruthy();
  for (const hidden of ["Workspace template", "Other project", "Unsupported project kind"])
    expect(screen.queryByRole("button", { name: new RegExp(hidden) })).toBeNull();
  expect(screen.getByText("web.project_templates_description")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Bug report Bug report summary" }));
  expect(state.navigate).toHaveBeenLastCalledWith("/w/settings/projects/p/templates/work-item/Bug report/");
  fireEvent.click(screen.getByRole("button", { name: "web.template_actions Project notes" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "edit" }));
  expect(state.navigate).toHaveBeenLastCalledWith("/w/settings/projects/p/templates/page/Project notes/");
});

it("offers only work item and page creation in project settings with scoped create routes", async () => {
  setup("p");
  await screen.findByText("Bug report summary");
  fireEvent.click(screen.getByRole("button", { name: "web.create_template" }));
  expect(screen.queryByRole("menuitem", { name: "web.template_kind_project" })).toBeNull();
  fireEvent.click(await screen.findByRole("menuitem", { name: "web.template_kind_work_item" }));
  expect(state.navigate).toHaveBeenLastCalledWith("/w/settings/projects/p/templates/work-item/");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "web.create_template" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "web.template_kind_page" }));
  expect(state.navigate).toHaveBeenLastCalledWith("/w/settings/projects/p/templates/page/");
});

it("renders an unboxed template empty state when no entries belong to the project", async () => {
  state.projectList.mockResolvedValue(entries.slice(2));
  setup("p");
  const empty = await screen.findByTestId("empty");
  expect(empty.getAttribute("data-asset")).toBe("template");
  expect(empty.className).not.toContain("border");
  expect(within(empty).getByRole("heading", { name: "web.templates_empty" })).toBeTruthy();
  expect(within(empty).getByText("web.project_templates_empty_description")).toBeTruthy();
});

function WorkspaceCacheProbe() {
  const { data } = useSWR(configurationKey("w", "templates"), () => service.list<WorkspaceTemplate>("w", "templates"));
  return <output aria-label="workspace cache">{data?.map((entry) => entry.id).join(",")}</output>;
}

it("deletes through the project endpoint and revalidates both project and global workspace lists", async () => {
  setup("p", <WorkspaceCacheProbe />);
  await screen.findByText("Bug report summary");
  await waitFor(() => expect(screen.getByLabelText("workspace cache").textContent).toContain("Bug report"));
  fireEvent.click(screen.getByRole("button", { name: "web.template_actions Bug report" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "delete" }));
  const dialog = await screen.findByRole("alertdialog", { name: "delete Bug report" });
  expect(state.projectRemove).not.toHaveBeenCalled();
  const remaining = entries.filter((entry) => entry.id !== "Bug report");
  state.projectList.mockResolvedValue(remaining);
  state.list.mockResolvedValue(remaining);
  fireEvent.click(within(dialog).getByRole("button", { name: "delete" }));
  await waitFor(() => expect(state.projectRemove).toHaveBeenCalledWith("w", "p", "Bug report"));
  await waitFor(() => expect(screen.queryByText("Bug report summary")).toBeNull());
  await waitFor(() => expect(screen.getByLabelText("workspace cache").textContent).not.toContain("Bug report"));
  expect(state.remove).not.toHaveBeenCalled();
  expect(state.projectList.mock.calls.length).toBeGreaterThan(1);
  expect(state.list.mock.calls.length).toBeGreaterThan(1);
  expect(state.dialog).toEqual({ isOpen: false, title: "delete Bug report" });
});

it("keeps the delete title while closing and cancels without a request", async () => {
  setup("p");
  await screen.findByText("Bug report summary");
  fireEvent.click(screen.getByRole("button", { name: "web.template_actions Bug report" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "delete" }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "cancel" }));
  await waitFor(() => expect(state.dialog.isOpen).toBe(false));
  expect(state.dialog.title).toBe("delete Bug report");
  expect(state.projectRemove).not.toHaveBeenCalled();
});

it("preserves workspace creation kinds and existing workspace routes", async () => {
  setup();
  await screen.findByText("Workspace template summary");
  expect(state.list).toHaveBeenCalledWith("w", "templates");
  expect(state.projectList).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "web.create_template" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "web.template_kind_project" }));
  expect(state.navigate).toHaveBeenLastCalledWith("/w/settings/templates/project/");
});
