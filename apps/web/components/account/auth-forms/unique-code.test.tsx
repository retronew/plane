import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EAuthModes } from "@/helpers/authentication.helper";
import { AuthUniqueCodeForm } from "./unique-code";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/services/auth.service", () => ({
  AuthService: class {
    requestCSRFToken = request;
  },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it("updates the hidden CSRF value when the request completes", async () => {
  let resolve: (value: { csrf_token: string }) => void = () => {};
  request.mockImplementation(
    () =>
      new Promise<{ csrf_token: string }>((done) => {
        resolve = done;
      })
  );
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(
    <AuthUniqueCodeForm
      mode={EAuthModes.SIGN_IN}
      email="test@example.com"
      isExistingEmail
      handleEmailClear={vi.fn()}
      generateEmailUniqueCode={vi.fn()}
      nextPath={undefined}
    />
  );
  const token = container.querySelector<HTMLInputElement>('input[name="csrfmiddlewaretoken"]');
  expect(token?.value).toBe("");
  await act(async () => resolve({ csrf_token: "token" }));
  expect(token?.value).toBe("token");
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});
