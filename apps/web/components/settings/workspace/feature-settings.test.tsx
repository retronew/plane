import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceFeatureSettings } from "./feature-settings";
const state = vi.hoisted(() => ({ allowed: true, save: vi.fn(), toast: vi.fn(), workspace: { ai_enabled: true } }));
vi.mock("react-router", () => ({ useParams: () => ({ workspaceSlug: "test" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ getWorkspaceBySlug: () => state.workspace, updateWorkspace: state.save }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => state.allowed }) }));
vi.mock("@/components/settings/content-wrapper", () => ({
  SettingsContentWrapper: ({ children, header }: { children: React.ReactNode; header: React.ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/settings/sidebar/collapse", () => ({ SettingsSidebarToggle: () => null }));
vi.mock("@/components/auth-screens/not-authorized-view", () => ({ NotAuthorizedView: () => <div>Forbidden</div> }));
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  state.allowed = true;
  state.save.mockReset();
  state.toast.mockReset();
});
it("saves the workspace toggle and reports failure without changing displayed state", async () => {
  state.save.mockRejectedValue(new Error("offline"));
  render(<WorkspaceFeatureSettings feature="ai" field="ai_enabled" />);
  fireEvent.click(screen.getByRole("switch"));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith("test", { ai_enabled: false }));
  await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});
it.each(["projects", "ai"] as const)("renders %s using the shared breadcrumb header", (feature) => {
  render(
    <WorkspaceFeatureSettings
      feature={feature}
      field={feature === "projects" ? "allow_member_project_creation" : "ai_enabled"}
    />
  );
  const title = screen.getByRole("navigation").querySelector('[aria-current="page"]');
  expect(title?.textContent).toBe(`web.workspace_${feature}_title`);
  expect(title?.querySelector("svg")).toBeTruthy();
});
it("does not expose a toggle to non-admin members", () => {
  state.allowed = false;
  render(<WorkspaceFeatureSettings feature="ai" field="ai_enabled" />);
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.getByText("Forbidden")).toBeTruthy();
});
