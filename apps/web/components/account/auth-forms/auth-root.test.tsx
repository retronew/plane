import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EAuthModes } from "@/helpers/authentication.helper";
import { AuthRoot } from "./auth-root";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
  Translation: ({ translationKey }: { translationKey: string }) => <span>{translationKey}</span>,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/hooks/store/use-instance", () => ({
  useInstance: () => ({ config: { is_email_password_enabled: true } }),
}));
vi.mock("@/hooks/oauth", () => ({ useOAuthConfig: () => ({ isOAuthEnabled: false, oAuthOptions: [] }) }));
vi.mock("./auth-header", () => ({
  AuthHeader: ({ authMode }: { authMode: string }) => <div data-testid="header">{authMode}</div>,
  AuthHeaderBase: () => <div data-testid="header-base" />,
}));
vi.mock("./form-root", () => ({ AuthFormRoot: () => <div data-testid="form" /> }));
vi.mock("../terms-and-conditions", () => ({ TermsAndConditions: () => null }));

it("renders the sign-in form on the first frame instead of waiting for an effect", () => {
  render(<AuthRoot authMode={EAuthModes.SIGN_IN} />);

  // No `await`: the prop is used directly, so the header and form are in the initial markup.
  expect(screen.getByTestId("header").textContent).toBe(EAuthModes.SIGN_IN);
  expect(screen.getByTestId("form")).toBeTruthy();
});

it("follows the mode passed by the caller", () => {
  render(<AuthRoot authMode={EAuthModes.SIGN_UP} />);

  expect(screen.getByTestId("header").textContent).toBe(EAuthModes.SIGN_UP);
});
