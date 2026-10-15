import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { expect, it, vi } from "vitest";
import { SettingsSidebarProvider } from "../../sidebar/collapse";
import { WorkspaceSettingsSidebarHeader } from "./header";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push }) }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ currentWorkspace: { slug: "other-workspace", name: "测试工作区", logo_url: null } }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ getWorkspaceRoleByWorkspaceSlug: () => 20 }),
}));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => ({ general_settings: "常规设置", back_to_workspace: "返回工作区" })[key] ?? key,
  }),
}));

function Location() {
  return <output aria-label="当前路径">{useLocation().pathname}</output>;
}

it("opens the current workspace's general settings from its identity and keeps the back action separate", () => {
  render(
    <MemoryRouter initialEntries={["/other-workspace/settings/members/"]}>
      <SettingsSidebarProvider>
        <WorkspaceSettingsSidebarHeader />
        <Location />
      </SettingsSidebarProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("link", { name: "测试工作区 · 常规设置" }));
  expect(screen.getByLabelText("当前路径").textContent).toBe("/other-workspace/settings/");
  fireEvent.click(screen.getByRole("button", { name: "返回工作区" }));
  expect(push).toHaveBeenCalledWith("/other-workspace/");
});
