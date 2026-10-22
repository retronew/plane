import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { NotificationsProfileSettings } from "./root";
const state = vi.hoisted(() => ({ list: vi.fn(), projects: vi.fn() }));
vi.mock("@plane/services", () => ({
  WorkspaceService: vi.fn(function () {
    return { list: state.list };
  }),
}));
vi.mock("@/services/project", () => ({
  ProjectService: vi.fn(function () {
    return { getProjectsLite: state.projects };
  }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./feishu-account", () => ({ FeishuAccount: () => null }));
vi.mock("./preferences-form", () => ({
  NotificationPreferencesForm: ({ scope }: { scope: unknown }) => (
    <output data-testid="scope">{JSON.stringify(scope)}</output>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("disables the project selector during loading and after a load failure, then enables it on retry", async () => {
  state.list.mockResolvedValue([{ id: "one", name: "First", slug: "first" }]);
  let rejectProjects!: (reason: Error) => void;
  state.projects
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectProjects = reject;
        })
    )
    .mockResolvedValue([{ id: "project", name: "Project" }]);
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <NotificationsProfileSettings />
    </SWRConfig>
  );
  fireEvent.click(screen.getByRole("combobox", { name: "notification_preferences.workspace" }));
  await chooseOption("First");
  const project = await screen.findByRole("combobox", { name: "notification_preferences.project" });
  expect(project.hasAttribute("disabled")).toBe(true);
  fireEvent.click(project);
  expect(screen.queryByRole("listbox")).toBeNull();
  rejectProjects(new Error("network"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(project.hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "notification_preferences.retry" }));
  await waitFor(() => expect(project.hasAttribute("disabled")).toBe(false));
  fireEvent.click(project);
  await chooseOption("Project");
  expect(screen.getByTestId("scope").textContent).toBe('{"workspace_id":"one","project_id":"project"}');
});
async function chooseOption(name: string) {
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}
it("selects workspace and project scopes and clears the project when changing workspace", async () => {
  state.list.mockResolvedValue([
    { id: "one", name: "First", slug: "first" },
    { id: "two", name: "Second", slug: "second" },
  ]);
  state.projects.mockImplementation(async (slug: string) =>
    slug === "first" ? [{ id: "project", name: "Project" }] : []
  );
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <NotificationsProfileSettings />
    </SWRConfig>
  );
  expect(screen.getByTestId("scope").textContent).toBe("{}");
  const workspace = screen.getByRole("combobox", { name: "notification_preferences.workspace" });
  expect(workspace.textContent).toContain("notification_preferences.global");
  fireEvent.click(workspace);
  await chooseOption("First");
  const project = await screen.findByRole("combobox", { name: "notification_preferences.project" });
  await waitFor(() => expect(project.hasAttribute("disabled")).toBe(false));
  fireEvent.click(project);
  await chooseOption("Project");
  expect(state.projects).toHaveBeenCalledWith("first");
  expect(screen.getByTestId("scope").textContent).toBe('{"workspace_id":"one","project_id":"project"}');
  fireEvent.click(workspace);
  await chooseOption("Second");
  await waitFor(() => expect(state.projects).toHaveBeenCalledWith("second"));
  expect(screen.getByTestId("scope").textContent).toBe('{"workspace_id":"two"}');
  expect(project.textContent).toContain("notification_preferences.workspace_defaults");
  fireEvent.click(workspace);
  await chooseOption("notification_preferences.global");
  expect(screen.getByTestId("scope").textContent).toBe("{}");
  expect(screen.queryByRole("combobox", { name: "notification_preferences.project" })).toBeNull();
});
