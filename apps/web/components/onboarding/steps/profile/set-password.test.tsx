import { StrictMode, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SetPasswordRoot } from "./set-password";

vi.mock("@plane/i18n", () => ({ translate: (key: string) => key, Translation: () => null }));
vi.mock("@plane/blocks/auth", () => ({
  PasswordInput: ({
    id,
    label,
    value,
    onChange,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label htmlFor={id}>
      {label}
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  ),
  PasswordStrengthIndicator: () => null,
}));

function PasswordForm({
  onPassword,
  onConfirm,
}: {
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <>
      <SetPasswordRoot
        onPasswordChange={(value) => {
          setPassword(value);
          onPassword(value);
        }}
        onConfirmPasswordChange={(value) => {
          setConfirm(value);
          onConfirm(value);
        }}
      />
      <output>{`${password}|${confirm}`}</output>
    </>
  );
}

describe("onboarding password notifications", () => {
  it("notifies the parent exactly once per input change under StrictMode", () => {
    const onPassword = vi.fn();
    const onConfirm = vi.fn();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        <StrictMode>
          <PasswordForm onPassword={onPassword} onConfirm={onConfirm} />
        </StrictMode>
      );
      fireEvent.click(screen.getByRole("button"));
      fireEvent.change(screen.getByLabelText("web.password"), { target: { value: "password1" } });
      fireEvent.change(screen.getByLabelText("web.confirm_password"), { target: { value: "password2" } });
      fireEvent.change(screen.getByLabelText("web.password"), { target: { value: "password2" } });
      expect(onPassword.mock.calls).toEqual([["password1"], ["password2"]]);
      expect(onConfirm.mock.calls).toEqual([["password2"]]);
      expect(screen.getByRole("status").textContent).toBe("password2|password2");
      expect(errors.mock.calls.flat().join(" ")).not.toContain("Cannot update a component");
    } finally {
      errors.mockRestore();
    }
  });
});
