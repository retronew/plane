import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthConnections } from "./oauth-connections";
const state = vi.hoisted(() => ({ data: undefined as unknown, error: undefined as unknown, mutate: vi.fn() }));
vi.mock("swr", () => ({ default: () => state }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key.split(".").pop() }) }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label, ...props }: { label: string }) => <button {...props}>{label}</button>,
}));
describe("inline OAuth connections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.error = undefined;
    state.data = {
      csrf_token: "csrf",
      connections: [
        {
          id: "grant1",
          client_name: "Test client",
          workspace_name: "Workspace",
          scope: "plane:read",
          expires_at: "2027-01-01T00:00:00Z",
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });
  it("confirms inline and revokes using session credentials and CSRF", async () => {
    render(<OAuthConnections />);
    expect(screen.getByText("Test client")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "oauth_revoke" }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "oauth_cancel" }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "oauth_revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "oauth_confirm_revoke" }));
    await waitFor(() =>
      expect(state.mutate).toHaveBeenCalledWith({ csrf_token: "csrf", connections: [] }, { revalidate: false })
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/mcp/connections/"),
      expect.objectContaining({ method: "POST", credentials: "include", headers: { "X-CSRFToken": "csrf" } })
    );
  });
  it("retains the connection and offers retry after revoke failure", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<OAuthConnections />);
    fireEvent.click(screen.getByRole("button", { name: "oauth_revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "oauth_confirm_revoke" }));
    expect((await screen.findByRole("alert")).textContent).toContain("oauth_revoke_error");
    expect(state.mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Test client")).toBeTruthy();
  });
  it("shows an empty state", () => {
    state.data = { csrf_token: "csrf", connections: [] };
    render(<OAuthConnections />);
    expect(screen.getByText("oauth_empty")).toBeTruthy();
  });
  it("shows loading and a retryable load error", () => {
    state.data = undefined;
    const { rerender } = render(<OAuthConnections />);
    expect(screen.getByText("oauth_loading")).toBeTruthy();
    state.error = new Error("offline");
    rerender(<OAuthConnections />);
    fireEvent.click(screen.getByRole("button", { name: "oauth_retry" }));
    expect(state.mutate).toHaveBeenCalled();
  });
});
