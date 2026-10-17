import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import ProjectUpdatesSettingsPage from "./page";

const mocks = vi.hoisted(() => ({
  project: undefined as IProject | undefined,
  updateProject: vi.fn(),
  toast: vi.fn(),
  isAdmin: true,
}));
vi.mock("@plane/i18n", async (original) => ({
  ...(await original<typeof import("@plane/i18n")>()),
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => mocks.project, updateProject: mocks.updateProject }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ workspaceUserInfo: {}, allowPermissions: () => mocks.isAdmin }),
}));
vi.mock("@plane/blocks/toast", () => ({ setPromiseToast: mocks.toast }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children, header }: { children: ReactNode; header: ReactNode }) => (
    <>
      {header}
      {children}
    </>
  ),
}));
vi.mock("@/components/core/page-title", () => ({ PageHead: () => null }));
vi.mock("@/components/auth-screens/not-authorized-view", () => ({
  NotAuthorizedView: () => <p>Not authorized</p>,
}));
const props = {
  params: { workspaceSlug: "workspace", projectId: "project" },
} as ComponentProps<typeof ProjectUpdatesSettingsPage>;
const prefix = "web.project_overview";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("PointerEvent", MouseEvent);
  mocks.isAdmin = true;
  mocks.project = observable({
    id: "project",
    name: "Project",
    archived_at: null,
    project_updates_view: false,
  } as IProject);
  mocks.updateProject.mockImplementation(async (_slug, _id, payload) => {
    runInAction(() => Object.assign(mocks.project!, payload));
    return mocks.project;
  });
});

afterEach(() => vi.unstubAllGlobals());

it("uses the shared feature switch to enable and disable project updates", async () => {
  render(<ProjectUpdatesSettingsPage {...props} />);
  expect(screen.getByRole("heading", { name: `${prefix}.updates_settings_title` })).toBeTruthy();
  expect(screen.getByText(`${prefix}.updates_settings_description`)).toBeTruthy();
  expect(screen.getByText(`${prefix}.enable_updates_description`)).toBeTruthy();
  expect(screen.getByRole("link", { name: `${prefix}.updates_documentation` }).getAttribute("href")).toBe(
    "https://docs.plane.so/communication-and-collaboration/project-updates#project-updates"
  );
  const toggle = screen.getByRole("switch", { name: `${prefix}.enable_updates` });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
  expect(mocks.updateProject).toHaveBeenLastCalledWith("workspace", "project", { project_updates_view: true });
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
  expect(mocks.updateProject).toHaveBeenLastCalledWith("workspace", "project", { project_updates_view: false });
  expect(mocks.toast).toHaveBeenCalledTimes(2);
});

it("protects the settings page from non-administrators", () => {
  mocks.isAdmin = false;
  render(<ProjectUpdatesSettingsPage {...props} />);
  expect(screen.getByText("Not authorized")).toBeTruthy();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(mocks.updateProject).not.toHaveBeenCalled();
});

it("disables the switch for an archived project", () => {
  mocks.project!.archived_at = "2026-10-17";
  render(<ProjectUpdatesSettingsPage {...props} />);
  const toggle = screen.getByRole("switch", { name: `${prefix}.enable_updates` });
  expect(toggle.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(toggle);
  expect(mocks.updateProject).not.toHaveBeenCalled();
});
