/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { observer } from "mobx-react";
import { CloseCircleOutline, HideOutline, ShowOutline } from "@makeplane/propel/icons";
// plane imports
import { API_BASE_URL, E_PASSWORD_STRENGTH } from "@plane/constants";
import { Button } from "@makeplane/propel/components/button";
import { Input } from "@makeplane/propel/components/input";
import { AuthService } from "@plane/services";
import { PasswordStrengthIndicator } from "@plane/blocks/auth";
import { getPasswordStrength } from "@plane/utils";
// types
import { EAuthModes, EAuthSteps } from "@/types/auth";
import { translate } from "@plane/i18n";

type Props = {
  email: string;
  isPasswordAutoset: boolean;
  isSMTPConfigured: boolean;
  mode: EAuthModes;
  nextPath: string | undefined;
  handleEmailClear: () => void;
  handleAuthStep: (step: EAuthSteps) => void;
};

type TPasswordFormValues = {
  email: string;
  password: string;
  confirm_password?: string;
};

const defaultValues: TPasswordFormValues = {
  email: "",
  password: "",
};

const authService = new AuthService();

const isPasswordStrong = (password: string) => getPasswordStrength(password) === E_PASSWORD_STRENGTH.STRENGTH_VALID;

const shouldShowPasswordStrength = (password: string, mode: EAuthModes) =>
  password.length > 0 && mode === EAuthModes.SIGN_UP && !isPasswordStrong(password);

const getIsButtonDisabled = (
  isSubmitting: boolean,
  mode: EAuthModes,
  password: string,
  confirmPassword: string | undefined
) => {
  if (isSubmitting || !password) return true;
  if (mode !== EAuthModes.SIGN_UP) return false;
  return !isPasswordStrong(password) || password !== confirmPassword;
};

const getAuthActionUrl = (mode: EAuthModes) =>
  `${API_BASE_URL}/auth/spaces/${mode === EAuthModes.SIGN_IN ? "sign-in" : "sign-up"}/`;

const prepareCSRFToken = async (
  formRef: RefObject<HTMLFormElement | null>,
  csrfPromise: Promise<{ csrf_token: string }> | undefined
) => {
  if (!formRef.current) return;
  const token = await csrfPromise;
  if (!token?.csrf_token) return;
  const csrfElement = formRef.current.querySelector("input[name=csrfmiddlewaretoken]");
  csrfElement?.setAttribute("value", token.csrf_token);
};

const submitAuthForm = async (
  event: FormEvent<HTMLFormElement>,
  formRef: RefObject<HTMLFormElement | null>,
  csrfPromise: Promise<{ csrf_token: string }> | undefined,
  setIsSubmitting: Dispatch<SetStateAction<boolean>>
) => {
  event.preventDefault();
  await prepareCSRFToken(formRef, csrfPromise);
  formRef.current?.submit();
  setIsSubmitting(true);
};

type TPasswordVisibilityButtonProps = {
  visible: boolean;
  onToggle: () => void;
};

function PasswordVisibilityButton({ visible, onToggle }: TPasswordVisibilityButtonProps) {
  return (
    <button
      type="button"
      aria-label={translate(visible ? "aria_labels.auth_forms.hide_password" : "aria_labels.auth_forms.show_password")}
      className="absolute right-3 hover:cursor-pointer"
      onClick={onToggle}
    >
      {visible ? (
        <HideOutline className="h-5 w-5 text-placeholder" />
      ) : (
        <ShowOutline className="h-5 w-5 text-placeholder" />
      )}
    </button>
  );
}

type TEmailFieldProps = {
  email: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

function EmailField({ email, onChange, onClear }: TEmailFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor="email">
        {translate("web.email")}
      </label>
      <div className="relative flex h-10 items-center rounded-md border border-subtle bg-surface-1 px-3 [&_input]:disable-autofill-style">
        <Input
          id="email"
          name="email"
          type="email"
          size="xl"
          value={email}
          onChange={(e) => onChange(e.target.value)}
          placeholder="name@company.com"
          disabled
        />
        {email.length > 0 && (
          <button
            type="button"
            aria-label={translate("web.clear_email")}
            className="absolute right-3 hover:cursor-pointer"
            onClick={onClear}
            tabIndex={-1}
          >
            <CloseCircleOutline className="h-5 w-5 text-placeholder" />
          </button>
        )}
      </div>
    </div>
  );
}

type TPasswordFieldProps = {
  mode: EAuthModes;
  password: string;
  isVisible: boolean;
  isFocused: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

function PasswordField({
  mode,
  password,
  isVisible,
  isFocused,
  onChange,
  onToggleVisibility,
  onFocus,
  onBlur,
}: TPasswordFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor="password">
        {mode === EAuthModes.SIGN_IN ? translate("web.password") : translate("web.set_a_password")}
      </label>
      <div className="relative flex h-10 items-center rounded-md border border-subtle bg-surface-1 pr-12 pl-3 [&_input]:disable-autofill-style">
        <Input
          id="password"
          type={isVisible ? "text" : "password"}
          name="password"
          size="xl"
          value={password}
          onChange={(e) => onChange(e.target.value)}
          placeholder={translate("web.enter_password")}
          onFocus={onFocus}
          onBlur={onBlur}
          autoComplete="off"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- sole primary field of a dedicated auth step; matches standard sign-in flows
          autoFocus
        />
        <PasswordVisibilityButton visible={isVisible} onToggle={onToggleVisibility} />
      </div>
      {shouldShowPasswordStrength(password, mode) && (
        <PasswordStrengthIndicator password={password} isFocused={isFocused} />
      )}
    </div>
  );
}

type TConfirmPasswordFieldProps = {
  password: string;
  confirmPassword: string | undefined;
  isVisible: boolean;
  isConfirmFocused: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

function ConfirmPasswordField({
  password,
  confirmPassword,
  isVisible,
  isConfirmFocused,
  onChange,
  onToggleVisibility,
  onFocus,
  onBlur,
}: TConfirmPasswordFieldProps) {
  const confirmPasswordValue = confirmPassword ?? "";
  const renderPasswordMatchError = !isConfirmFocused || confirmPasswordValue.length >= password.length;
  const showPasswordMismatch = !!confirmPassword && password !== confirmPassword && renderPasswordMatchError;

  return (
    <div className="space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor="confirm_password">
        {translate("web.confirm_password")}
      </label>
      <div className="relative flex h-10 items-center rounded-md border border-subtle bg-surface-1 pr-12 pl-3 [&_input]:disable-autofill-style">
        <Input
          id="confirm_password"
          type={isVisible ? "text" : "password"}
          name="confirm_password"
          size="xl"
          value={confirmPassword}
          onChange={(e) => onChange(e.target.value)}
          placeholder={translate("web.confirm_password")}
          onFocus={onFocus}
          onBlur={onBlur}
          autoComplete="off"
        />
        <PasswordVisibilityButton visible={isVisible} onToggle={onToggleVisibility} />
      </div>
      {showPasswordMismatch && (
        <span className="text-13 text-danger-primary">{translate("web.runtime.passwords_mismatch")}</span>
      )}
    </div>
  );
}

type TAuthFormButtonsProps = {
  mode: EAuthModes;
  isSMTPConfigured: boolean;
  isButtonDisabled: boolean;
  isSubmitting: boolean;
  onUniqueCodeSignIn: () => void;
};

function AuthFormButtons({
  mode,
  isSMTPConfigured,
  isButtonDisabled,
  isSubmitting,
  onUniqueCodeSignIn,
}: TAuthFormButtonsProps) {
  if (mode === EAuthModes.SIGN_UP) {
    return (
      <div className="space-y-2.5">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          stretch="full"
          disabled={isButtonDisabled}
          loading={isSubmitting}
          label={translate("web.create_account")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <Button
        type="submit"
        variant="primary"
        size="lg"
        stretch="full"
        disabled={isButtonDisabled}
        loading={isSubmitting}
        label={isSMTPConfigured ? translate("web.continue") : translate("web.go_to_workspace")}
      />
      {isSMTPConfigured && (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          stretch="full"
          label={translate("web.sign_in_with_unique_code")}
          onClick={onUniqueCodeSignIn}
        />
      )}
    </div>
  );
}

export const AuthPasswordForm = observer(function AuthPasswordForm(props: Props) {
  const { email, nextPath, isSMTPConfigured, handleAuthStep, handleEmailClear, mode } = props;
  // ref
  const formRef = useRef<HTMLFormElement>(null);
  // states
  const [csrfPromise, setCsrfPromise] = useState<Promise<{ csrf_token: string }> | undefined>(undefined);
  const [passwordFormData, setPasswordFormData] = useState<TPasswordFormValues>({ ...defaultValues, email });
  const [showPassword, setShowPassword] = useState({
    password: false,
    retypePassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleFormChange = (key: keyof TPasswordFormValues, value: string) =>
    setPasswordFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (csrfPromise === undefined) {
      const promise = authService.requestCSRFToken();
      setCsrfPromise(promise);
    }
  }, [csrfPromise]);

  const redirectToUniqueCodeSignIn = async () => {
    handleAuthStep(EAuthSteps.UNIQUE_CODE);
  };

  const isButtonDisabled = useMemo(
    () => getIsButtonDisabled(isSubmitting, mode, passwordFormData.password, passwordFormData.confirm_password),
    [isSubmitting, mode, passwordFormData.confirm_password, passwordFormData.password]
  );

  return (
    <form
      ref={formRef}
      className="mt-5 space-y-4"
      method="POST"
      action={getAuthActionUrl(mode)}
      onSubmit={(event) => submitAuthForm(event, formRef, csrfPromise, setIsSubmitting)}
    >
      <input type="hidden" name="csrfmiddlewaretoken" />
      <input type="hidden" value={passwordFormData.email} name="email" />
      <input type="hidden" value={nextPath} name="next_path" />
      <EmailField
        email={passwordFormData.email}
        onChange={(value) => handleFormChange("email", value)}
        onClear={handleEmailClear}
      />

      <PasswordField
        mode={mode}
        password={passwordFormData.password}
        isVisible={showPassword.password}
        isFocused={isPasswordInputFocused}
        onChange={(value) => handleFormChange("password", value)}
        onToggleVisibility={() => handleShowPassword("password")}
        onFocus={() => setIsPasswordInputFocused(true)}
        onBlur={() => setIsPasswordInputFocused(false)}
      />

      {mode === EAuthModes.SIGN_UP && (
        <ConfirmPasswordField
          password={passwordFormData.password}
          confirmPassword={passwordFormData.confirm_password}
          isVisible={showPassword.retypePassword}
          isConfirmFocused={isRetryPasswordInputFocused}
          onChange={(value) => handleFormChange("confirm_password", value)}
          onToggleVisibility={() => handleShowPassword("retypePassword")}
          onFocus={() => setIsRetryPasswordInputFocused(true)}
          onBlur={() => setIsRetryPasswordInputFocused(false)}
        />
      )}

      <AuthFormButtons
        mode={mode}
        isSMTPConfigured={isSMTPConfigured}
        isButtonDisabled={isButtonDisabled}
        isSubmitting={isSubmitting}
        onUniqueCodeSignIn={redirectToUniqueCodeSignIn}
      />
    </form>
  );
});
