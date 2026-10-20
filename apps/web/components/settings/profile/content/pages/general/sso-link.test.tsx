import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSSOLink } from "./sso-link";

const state = vi.hoisted(() => ({ replace: vi.fn(), mutate: vi.fn(), toast: vi.fn(), enabled: true }));
vi.mock("mobx-react", () => ({ observer: (component: unknown) => component }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/constants", () => ({ API_BASE_URL: "" }));
vi.mock("@plane/utils", () => ({ cn: (...values: unknown[]) => values.filter(Boolean).join(" ") }));
vi.mock("@plane/services", () => ({ AuthService: vi.fn(function AuthService() {}) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: state.toast }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("swr", () => ({ default: () => ({ data: { linked: true }, mutate: state.mutate }) }));
vi.mock("@/hooks/store/use-instance", () => ({
  useInstance: () => ({ config: { is_oidc_enabled: state.enabled, oidc_provider_name: "OIDC" } }),
}));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ replace: state.replace }) }));
vi.mock("@/helpers/authentication.helper", () => ({ authErrorHandler: () => undefined }));
vi.mock("@/components/core/modals/change-email-modal", () => ({ ChangeEmailModal: () => null }));
vi.mock("@makeplane/propel/components/button", () => ({
  Button: ({ label }: { label: string }) => <button>{label}</button>,
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  state.enabled = true;
  window.history.replaceState({}, "", "/workspace/?keep=1&oidc_linked=1&oidc_email=other%40example.com#section");
});

describe("profile SSO card", () => {
  it("uses a boxed control and preserves unrelated URL state after the callback", async () => {
    render(<ProfileSSOLink currentEmail="me@example.com" />);
    const title = screen.getByRole("heading", { name: "web.sso_link.title" });
    expect(title.parentElement?.parentElement?.className).toContain("border border-subtle");
    expect(screen.getByText("web.sso_link.email_differs")).toBeTruthy();
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/workspace/?keep=1#section"));
    expect(state.mutate).toHaveBeenCalled();
  });

  it("clears an error result without discarding unrelated query parameters", async () => {
    window.history.replaceState({}, "", "/workspace/?keep=1&error_code=OIDC_FAILED#section");
    render(<ProfileSSOLink currentEmail="me@example.com" />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/workspace/?keep=1#section"));
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("does not render a card when OIDC is disabled", () => {
    window.history.replaceState({}, "", "/workspace/");
    state.enabled = false;
    const { container } = render(<ProfileSSOLink currentEmail="me@example.com" />);
    expect(container.childElementCount).toBe(0);
  });
});
