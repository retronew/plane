import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "./reset-password";
import { SetPasswordForm } from "./set-password";

const mocks = vi.hoisted(() => ({ csrf: vi.fn(), setPassword: vi.fn(), push: vi.fn() }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("email=a@example.com&uidb64=uid&token=token"),
}));
vi.mock("@/services/auth.service", () => ({
  AuthService: class {
    requestCSRFToken = mocks.csrf;
  },
}));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: undefined, handleSetPassword: mocks.setPassword }) }));
vi.mock("@/hooks/use-app-router", () => ({ useAppRouter: () => ({ push: mocks.push }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@plane/blocks/auth", () => ({
  PasswordStrengthIndicator: ({ isFocused }: { isFocused: boolean }) => (
    <div data-testid="strength">{String(isFocused)}</div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.csrf.mockResolvedValue({ csrf_token: "csrf" });
});

for (const [name, Form] of [
  ["reset", ResetPasswordForm],
  ["set", SetPasswordForm],
] as const) {
  it(`${name} names independent visibility controls and preserves input semantics`, async () => {
    render(<Form />);
    await act(async () => {});
    const password = screen.getByLabelText("auth.common.password.label") as HTMLInputElement;
    const confirm = screen.getByLabelText("auth.common.password.confirm_password.label") as HTMLInputElement;
    expect(password.autocomplete).toBe("new-password");
    expect(confirm.name).toBe("confirm_password");
    expect(confirm.value).toBe("");
    expect(password.minLength).toBe(8);
    const toggles = screen.getAllByRole("button", { name: "aria_labels.auth_forms.show_password" });
    fireEvent.click(toggles[0]);
    expect(password.type).toBe("text");
    expect(confirm.type).toBe("password");
    expect(screen.getByRole("button", { name: "aria_labels.auth_forms.hide_password" }).getAttribute("type")).toBe(
      "button"
    );
    fireEvent.focus(password);
    expect(screen.getByTestId("strength").textContent).toBe("true");
    fireEvent.blur(password);
    expect(screen.getByTestId("strength").textContent).toBe("false");
    fireEvent.change(password, { target: { value: "LongPassword123!" } });
    fireEvent.focus(confirm);
    fireEvent.change(confirm, { target: { value: "x" } });
    expect(screen.queryByText("auth.common.password.errors.match")).toBeNull();
    fireEvent.blur(confirm);
    expect(screen.getByText("auth.common.password.errors.match")).toBeTruthy();
    fireEvent.change(confirm, { target: { value: "LongPassword123!" } });
    expect(screen.queryByText("auth.common.password.errors.match")).toBeNull();
  });

  it(`${name} handles CSRF rejection locally`, async () => {
    mocks.csrf.mockRejectedValueOnce(new Error("offline"));
    render(<Form />);
    await act(async () => {});
    expect(mocks.setPassword).not.toHaveBeenCalled();
  });
}

it("retains reset native POST fields", async () => {
  const { container } = render(<ResetPasswordForm />);
  await act(async () => {});
  const form = container.querySelector("form")!;
  expect(form.method).toBe("post");
  expect(form.getAttribute("action")).toContain("/auth/reset-password/uid/token/");
  expect(new FormData(form).get("csrfmiddlewaretoken")).toBe("csrf");
  expect(new FormData(form).has("email")).toBe(false);
});

it("sets the password through the authenticated service then navigates", async () => {
  const { container } = render(<SetPasswordForm />);
  await act(async () => {});
  for (const label of ["auth.common.password.label", "auth.common.password.confirm_password.label"]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: "LongPassword123!" } });
  }
  fireEvent.submit(container.querySelector("form")!);
  await act(async () => {});
  expect(mocks.setPassword).toHaveBeenCalledWith("csrf", { password: "LongPassword123!" });
  expect(mocks.push).toHaveBeenCalledWith("/");
});
