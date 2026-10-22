import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthConnections } from "./oauth-connections";
const state = vi.hoisted(() => ({ data: undefined as unknown, error: undefined as unknown, mutate: vi.fn() }));
vi.mock("swr", () => ({ default: () => state }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ currentLocale: "en", t: (key: string) => key.split(".").pop() }),
}));

async function action(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "actions: Test client" }));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

describe("OAuth connection management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.error = undefined;
    state.data = {
      csrf_token: "csrf",
      connections: [
        {
          id: "grant1",
          client_name: "Test client",
          workspace_name: null,
          scope: "plane:read",
          created_at: "2026-10-22T00:00:00Z",
          expires_at: "2027-01-01T00:00:00Z",
          status: "active",
        },
        {
          id: "grant2",
          client_name: "Second client",
          workspace_name: "Legacy workspace",
          scope: "plane:read plane:write",
          created_at: "2026-10-22T00:00:00Z",
          expires_at: "2027-01-01T00:00:00Z",
          status: "pending",
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });
  it("renders a searchable table with account and legacy scope", () => {
    render(<OAuthConnections />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.getByText("account_scope")).toBeTruthy();
    expect(screen.getByText("Legacy workspace")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "search" }), { target: { value: "Second" } });
    expect(screen.queryByText("Test client")).toBeNull();
    expect(screen.getByText("Second client")).toBeTruthy();
  });
  it("cancels without a request, then revokes only the selected grant with CSRF", async () => {
    render(<OAuthConnections />);
    await action("revoke");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "cancel" }));
    expect(fetch).not.toHaveBeenCalled();
    await action("revoke");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "revoke" }));
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][0].connections.map((item: { id: string }) => item.id)).toEqual(["grant2"]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/mcp/connections/"),
      expect.objectContaining({ method: "POST", credentials: "include", headers: { "X-CSRFToken": "csrf" } })
    );
    expect(vi.mocked(fetch).mock.calls[0][1]?.body?.toString()).toBe("grant=grant1");
  });
  it("reauthorization explains the client step and waits for confirmation", async () => {
    render(<OAuthConnections />);
    await action("reconnect");
    expect(screen.getByText(/reconnect_confirm/)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "reconnect_action" }));
    expect(await screen.findByText("reconnect_next")).toBeTruthy();
  });
  it("retains the connection and offers retry after revoke failure", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
    render(<OAuthConnections />);
    await action("revoke");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "revoke" }));
    expect((await screen.findByRole("alert")).textContent).toContain("revoke_error");
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("shows empty, loading, and recoverable error states", () => {
    state.data = undefined;
    const { rerender } = render(<OAuthConnections />);
    expect(screen.getByText("loading")).toBeTruthy();
    state.error = new Error("offline");
    rerender(<OAuthConnections />);
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(state.mutate).toHaveBeenCalled();
    state.error = undefined;
    state.data = { csrf_token: "csrf", connections: [] };
    rerender(<OAuthConnections />);
    expect(screen.getByText("empty")).toBeTruthy();
  });
});
