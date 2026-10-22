import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { returnToMcpClient } from "@/helpers/mcp-connect";
import { OAuthConsent } from "./consent";
const state = vi.hoisted(() => ({ data: undefined as unknown, error: undefined as unknown, mutate: vi.fn() }));
vi.mock("swr", () => ({ default: () => state }));
vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    currentLocale: "en",
    languages: [{ value: "en", label: "English" }],
    changeLanguage: vi.fn(),
    t: (key: string) => key.split(".").pop(),
  }),
}));
vi.mock("@/helpers/mcp-connect", () => ({ returnToMcpClient: vi.fn() }));
const flow = "a".repeat(43);
describe("account OAuth consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.error = undefined;
    vi.stubGlobal("PointerEvent", MouseEvent);
    state.data = {
      ticket: "signed-ticket",
      csrf_token: "csrf",
      client_name: "Client",
      account_email: "test@example.test",
      redirect_uri: "http://127.0.0.1:43210/callback",
      write_requested: true,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ redirect_url: "http://127.0.0.1:43210/callback?state=s" }),
      })
    );
  });
  it("defaults to read only without a workspace selector and explains account scope", async () => {
    render(<OAuthConsent flow={flow} />);
    expect(screen.getByText("consent_scope")).toBeTruthy();
    expect(screen.getAllByRole("combobox")).toHaveLength(1); // language only
    fireEvent.click(screen.getByRole("button", { name: "allow" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const options = vi.mocked(fetch).mock.calls[0][1];
    expect(options?.credentials).toBe("include");
    expect(options?.headers).toEqual({ Accept: "application/json", "X-CSRFToken": "csrf" });
    expect(options?.body?.toString()).toBe("ticket=signed-ticket&decision=allow&write=no");
    expect(await screen.findByText("returning")).toBeTruthy();
    expect(returnToMcpClient).toHaveBeenCalledWith("http://127.0.0.1:43210/callback?state=s");
  });
  it("requires an explicit checkbox for writes", async () => {
    render(<OAuthConsent flow={flow} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "allow_write" }));
    fireEvent.click(screen.getByRole("button", { name: "allow" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(vi.mocked(fetch).mock.calls[0][1]?.body?.toString()).toContain("write=yes");
  });
  it("cancels through the server and never grants access", async () => {
    render(<OAuthConsent flow={flow} />);
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(await screen.findByText("cancelled")).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls[0][1]?.body?.toString()).toContain("decision=deny");
  });
  it("shows retry instructions when submitting fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<OAuthConsent flow={flow} />);
    fireEvent.click(screen.getByRole("button", { name: "allow" }));
    expect((await screen.findByRole("alert")).textContent).toBe("submit_error");
    expect(screen.queryByText("returning")).toBeNull();
  });
  it("never renders consent for an invalid or expired flow", () => {
    const { rerender } = render(<OAuthConsent flow="invalid" />);
    expect(screen.queryByRole("button", { name: "allow" })).toBeNull();
    expect(screen.getByText("expired_hint")).toBeTruthy();
    state.error = new Error("expired");
    rerender(<OAuthConsent flow={flow} />);
    expect(screen.queryByRole("button", { name: "allow" })).toBeNull();
  });
});
