import { useState } from "react";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { HideOutline, ShowOutline } from "@makeplane/propel/icons";
import { PasswordStrengthIndicator } from "@plane/blocks/auth";
import { useTranslation } from "@plane/i18n";

type PasswordFieldProps = {
  name: "password" | "confirm_password";
  value: string;
  onChange: (value: string) => void;
  password?: string;
};

export function PasswordField({ name, value, onChange, password }: PasswordFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const isConfirmation = name === "confirm_password";
  const mismatch =
    isConfirmation && !!value && value !== password && (!focused || value.length >= (password?.length ?? 0));

  return (
    <div className="space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor={name}>
        {t(isConfirmation ? "auth.common.password.confirm_password.label" : "auth.common.password.label")}
      </label>
      <InputGroup size="2xl">
        <Input
          size="2xl"
          type={visible ? "text" : "password"}
          name={name}
          id={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t(
            isConfirmation ? "auth.common.password.confirm_password.placeholder" : "auth.common.password.placeholder"
          )}
          minLength={isConfirmation ? undefined : 8}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="new-password"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus on open
          autoFocus={!isConfirmation}
        />
        <button
          type="button"
          aria-label={t(visible ? "aria_labels.auth_forms.hide_password" : "aria_labels.auth_forms.show_password")}
          aria-controls={name}
          onClick={() => setVisible((previous) => !previous)}
          className="grid size-5 place-items-center"
        >
          {visible ? (
            <HideOutline aria-hidden="true" className="size-5 text-placeholder" />
          ) : (
            <ShowOutline aria-hidden="true" className="size-5 text-placeholder" />
          )}
        </button>
      </InputGroup>
      {!isConfirmation && <PasswordStrengthIndicator password={value} isFocused={focused} />}
      {mismatch && <span className="text-13 text-danger-primary">{t("auth.common.password.errors.match")}</span>}
    </div>
  );
}
