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
afterEach(cleanup);
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
  await screen.findByRole("option", { name: "First" });
  fireEvent.change(screen.getByLabelText("notification_preferences.workspace"), { target: { value: "one" } });
  await screen.findByRole("option", { name: "Project" });
  expect(state.projects).toHaveBeenCalledWith("first");
  fireEvent.change(screen.getByLabelText("notification_preferences.project"), { target: { value: "project" } });
  expect(screen.getByTestId("scope").textContent).toBe('{"workspace_id":"one","project_id":"project"}');
  fireEvent.change(screen.getByLabelText("notification_preferences.workspace"), { target: { value: "two" } });
  await waitFor(() => expect(state.projects).toHaveBeenCalledWith("second"));
  expect(screen.getByTestId("scope").textContent).toBe('{"workspace_id":"two"}');
  expect((screen.getByLabelText("notification_preferences.project") as HTMLSelectElement).value).toBe("");
});
