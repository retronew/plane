import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { IProject } from "@plane/types";
import { LeaveProjectModal } from "./leave-project-modal";

const mocks = vi.hoisted(() => ({ leave: vi.fn(), push: vi.fn(), close: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspaceSlug: "workspace" }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ leaveProject: mocks.leave }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: mocks.toast }));
vi.mock("@plane/i18n", () => ({
  translate: (key: string) => (key === "web.leave_project" ? "离开项目" : key),
  Translation: () => null,
}));
const project: IProject = {
  id: "project-1",
  name: "Example",
  identifier: "EX",
  workspace: "workspace-1",
  member_role: 15,
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
function fillForm(phrase = "离开项目") {
  const view = render(<LeaveProjectModal project={project} isOpen onClose={mocks.close} />);
  fireEvent.change(document.querySelector('input[name="projectName"]')!, { target: { value: "Example" } });
  fireEvent.change(document.querySelector('input[name="confirmLeave"]')!, { target: { value: phrase } });
  return view;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.leave.mockResolvedValue(undefined);
});
it("accepts the confirmation phrase displayed in the current language", async () => {
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: "离开项目" }));
  await waitFor(() => expect(mocks.leave).toHaveBeenCalledWith("workspace", "project-1"));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workspace/projects/"));
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("keeps the dialog and current route when the backend rejects leaving", async () => {
  mocks.leave.mockRejectedValueOnce(new Error("only admin"));
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: "离开项目" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
});
it("rejects a phrase that differs from the displayed confirmation", async () => {
  fillForm("Leave Project");
  fireEvent.click(screen.getByRole("button", { name: "离开项目" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(mocks.leave).not.toHaveBeenCalled();
});
