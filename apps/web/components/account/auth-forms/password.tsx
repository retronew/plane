/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
// icons
import { CloseCircleOutline, HideOutline, ShowOutline } from "@makeplane/propel/icons";
// plane imports
import { Banner } from "@makeplane/propel/components/banner";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { API_BASE_URL, E_PASSWORD_STRENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { PasswordStrengthIndicator } from "@plane/blocks/auth";
import { getPasswordStrength } from "@plane/utils";
// components
import { ForgotPasswordPopover } from "@/components/account/auth-forms/forgot-password-popover";
// constants
// helpers
import { EAuthModes, EAuthSteps } from "@/helpers/authentication.helper";
// services
import { AuthService } from "@/services/auth.service";

type Props = {
  email: string;
  isSMTPConfigured: boolean;
  mode: EAuthModes;
  handleEmailClear: () => void;
  handleAuthStep: (step: EAuthSteps) => void;
  nextPath: string | undefined;
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

const getAuthAction = (mode: EAuthModes) =>
  `${API_BASE_URL}/auth/${mode === EAuthModes.SIGN_IN ? "sign-in" : "sign-up"}/`;

const getIsButtonDisabled = (values: TPasswordFormValues, mode: EAuthModes, isSubmitting: boolean) =>
  !(!isSubmitting && !!values.password && (mode !== EAuthModes.SIGN_UP || values.password === values.confirm_password));

function PasswordSupport(props: {
  mode: EAuthModes;
  isSMTPConfigured: boolean;
  email: string;
  password: string;
  isPasswordInputFocused: boolean;
}) {
  const { t } = useTranslation();

  if (props.mode === EAuthModes.SIGN_IN) {
    return (
      <div className="w-full">
        {props.isSMTPConfigured ? (
          <Link
            href={`/accounts/forgot-password?email=${encodeURIComponent(props.email)}`}
            className="text-11 font-medium text-accent-primary"
          >
            {t("auth.common.forgot_password")}
          </Link>
        ) : (
          <ForgotPasswordPopover />
        )}
      </div>
    );
  }

  if (props.password.length > 0 && getPasswordStrength(props.password) != E_PASSWORD_STRENGTH.STRENGTH_VALID) {
    return <PasswordStrengthIndicator password={props.password} isFocused={props.isPasswordInputFocused} />;
  }

  return null;
}

function PasswordEmailField(props: { email: string; onChange: (value: string) => void; onClear: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      <label htmlFor="email" className="text-13 font-medium text-tertiary">
        {t("auth.common.email.label")}
      </label>
      <InputGroup size="2xl">
        <Input
          size="2xl"
          id="email"
          name="email"
          type="email"
          value={props.email}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={t("auth.common.email.placeholder")}
          disabled
        />
        {props.email.length > 0 && (
          <button
            type="button"
            className="grid size-5 place-items-center"
            onClick={props.onClear}
            aria-label={t("aria_labels.auth_forms.clear_email")}
          >
            <CloseCircleOutline className="size-5 text-placeholder" />
          </button>
        )}
      </InputGroup>
    </div>
  );
}

function PasswordInputField(props: {
  mode: EAuthModes;
  value: string;
  isSMTPConfigured: boolean;
  email: string;
  isVisible: boolean;
  isFocused: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      <label htmlFor="password" className="text-13 font-medium text-tertiary">
        {props.mode === EAuthModes.SIGN_IN ? t("auth.common.password.label") : t("auth.common.password.set_password")}
      </label>
      <InputGroup size="2xl">
        <Input
          size="2xl"
          type={props.isVisible ? "text" : "password"}
          id="password"
          name="password"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={t("auth.common.password.placeholder")}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          autoComplete="off"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional focus on open
          autoFocus
        />
        <button
          type="button"
          onClick={props.onToggleVisibility}
          className="grid size-5 place-items-center"
          aria-label={t(
            props.isVisible ? "aria_labels.auth_forms.hide_password" : "aria_labels.auth_forms.show_password"
          )}
        >
          {props.isVisible ? (
            <HideOutline className="size-5 text-placeholder" />
          ) : (
            <ShowOutline className="size-5 text-placeholder" />
          )}
        </button>
      </InputGroup>
      <PasswordSupport
        mode={props.mode}
        isSMTPConfigured={props.isSMTPConfigured}
        email={props.email}
        password={props.value}
        isPasswordInputFocused={props.isFocused}
      />
    </div>
  );
}

function ConfirmPasswordField(props: {
  password: string;
  value: string;
  isVisible: boolean;
  isFocused: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation();
  const shouldShowMatchError = !props.isFocused || props.value.length >= props.password.length;

  return (
    <div className="space-y-1">
      <label htmlFor="confirm-password" className="text-13 font-medium text-tertiary">
        {t("auth.common.password.confirm_password.label")}
      </label>
      <InputGroup size="2xl">
        <Input
          size="2xl"
          type={props.isVisible ? "text" : "password"}
          id="confirm-password"
          name="confirm_password"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={t("auth.common.password.confirm_password.placeholder")}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          autoComplete="off"
        />
        <button
          type="button"
          className="grid size-5 place-items-center"
          aria-label={t(
            props.isVisible ? "aria_labels.auth_forms.hide_password" : "aria_labels.auth_forms.show_password"
          )}
          onClick={props.onToggleVisibility}
        >
          {props.isVisible ? (
            <HideOutline className="size-5 text-placeholder" />
          ) : (
            <ShowOutline className="size-5 text-placeholder" />
          )}
        </button>
      </InputGroup>
      {!!props.value && props.password !== props.value && shouldShowMatchError && (
        <span className="text-13 text-danger-primary">{t("auth.common.password.errors.match")}</span>
      )}
    </div>
  );
}

function PasswordFormActions(props: {
  mode: EAuthModes;
  isSMTPConfigured: boolean;
  isButtonDisabled: boolean;
  isSubmitting: boolean;
  onUniqueCodeSignIn: () => void;
}) {
  const { t } = useTranslation();

  if (props.mode !== EAuthModes.SIGN_IN) {
    return (
      <div className="space-y-2.5">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          stretch="full"
          disabled={props.isButtonDisabled}
          loading={props.isSubmitting}
          label={t("web.create_account")}
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
        disabled={props.isButtonDisabled}
        loading={props.isSubmitting}
        label={props.isSMTPConfigured ? t("common.continue") : t("common.go_to_workspace")}
      />
      {props.isSMTPConfigured && (
        <Button
          type="button"
          onClick={props.onUniqueCodeSignIn}
          variant="secondary"
          size="lg"
          stretch="full"
          label={t("auth.common.sign_in_with_unique_code")}
        />
      )}
    </div>
  );
}

export const AuthPasswordForm = observer(function AuthPasswordForm(props: Props) {
  const { email, isSMTPConfigured, handleAuthStep, handleEmailClear, mode, nextPath } = props;
  // plane imports
  const { t } = useTranslation();
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
  const [isBannerMessage, setBannerMessage] = useState(false);

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
    () => getIsButtonDisabled(passwordFormData, mode, isSubmitting),
    [isSubmitting, mode, passwordFormData]
  );

  const handleCSRFToken = async () => {
    if (!formRef || !formRef.current) return;
    const token = await csrfPromise;
    if (!token?.csrf_token) return;
    const csrfElement = formRef.current.querySelector("input[name=csrfmiddlewaretoken]");
    csrfElement?.setAttribute("value", token?.csrf_token);
  };

  return (
    <>
      {isBannerMessage && mode === EAuthModes.SIGN_UP && (
        <Banner
          placement="inline"
          variant="danger"
          description={t("auth.sign_up.errors.password.strength")}
          dismissLabel={t("close")}
          onDismiss={() => setBannerMessage(false)}
        />
      )}
      <form
        ref={formRef}
        className="space-y-4"
        method="POST"
        action={getAuthAction(mode)}
        onSubmit={async (event) => {
          event.preventDefault(); // Prevent form from submitting by default
          await handleCSRFToken();
          const isPasswordValid =
            mode === EAuthModes.SIGN_UP
              ? getPasswordStrength(passwordFormData.password) === E_PASSWORD_STRENGTH.STRENGTH_VALID
              : true;
          if (isPasswordValid) {
            setIsSubmitting(true);
            if (formRef.current) formRef.current.submit(); // Manually submit the form if the condition is met
          } else {
            setBannerMessage(true);
          }
        }}
        onErrorCapture={() => {
          setIsSubmitting(false);
        }}
      >
        <input type="hidden" name="csrfmiddlewaretoken" />
        <input type="hidden" value={passwordFormData.email} name="email" />
        {nextPath && <input type="hidden" value={nextPath} name="next_path" />}

        <PasswordEmailField
          email={passwordFormData.email}
          onChange={(value) => handleFormChange("email", value)}
          onClear={handleEmailClear}
        />

        <PasswordInputField
          mode={mode}
          value={passwordFormData.password}
          isSMTPConfigured={isSMTPConfigured}
          email={email}
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
            value={passwordFormData.confirm_password ?? ""}
            isVisible={showPassword.retypePassword}
            isFocused={isRetryPasswordInputFocused}
            onChange={(value) => handleFormChange("confirm_password", value)}
            onToggleVisibility={() => handleShowPassword("retypePassword")}
            onFocus={() => setIsRetryPasswordInputFocused(true)}
            onBlur={() => setIsRetryPasswordInputFocused(false)}
          />
        )}

        <PasswordFormActions
          mode={mode}
          isSMTPConfigured={isSMTPConfigured}
          isButtonDisabled={isButtonDisabled}
          isSubmitting={isSubmitting}
          onUniqueCodeSignIn={redirectToUniqueCodeSignIn}
        />
      </form>
    </>
  );
});
