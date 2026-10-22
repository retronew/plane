import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpProfileSettings } from "./mcp";

const state = vi.hoisted(() => ({ isOpen: true, toggle: vi.fn(), push: vi.fn() }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({
    profileSettingsModal: { isOpen: state.isOpen },
    toggleProfileSettingsModal: state.toggle,
  }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: state.push }) }));
vi.mock("@/components/api-token/mcp-setup", () => ({ ApiTokenMcpSetup: () => <div>MCP template</div> }));
vi.mock("@/components/settings/profile/heading", () => ({
  ProfileSettingsHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, onClick }: { label: string; onClick: () => void }) => <button onClick={onClick}>{label}</button>,
}));

describe("MCP personal settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isOpen = true;
  });

  it("shows setup without requiring a token and switches the open settings modal to tokens", () => {
    render(<McpProfileSettings />);
    expect(screen.getByText("MCP template")).toBeTruthy();
    expect(screen.queryByText("OAuth inline management")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.manage_connections" }));
    expect(state.toggle).toHaveBeenCalledWith({ activeTab: "oauth-connections", isOpen: true });
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.manage_tokens" }));
    expect(state.toggle).toHaveBeenCalledWith({ activeTab: "api-tokens", isOpen: true });
    expect(state.push).not.toHaveBeenCalled();
  });

  it("opens the token settings modal when settings were closed", () => {
    state.isOpen = false;
    render(<McpProfileSettings />);
    fireEvent.click(screen.getByRole("button", { name: "account_settings.mcp.manage_tokens" }));
    expect(state.toggle).toHaveBeenCalledWith({ activeTab: "api-tokens", isOpen: true });
    expect(state.push).not.toHaveBeenCalled();
  });
});

vi.mock("@/components/api-token/oauth-connections", () => ({
  OAuthConnections: () => <div>OAuth inline management</div>,
}));
