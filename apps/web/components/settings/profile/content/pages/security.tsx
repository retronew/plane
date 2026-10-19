/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Controller, useForm, type Control } from "react-hook-form";
import { HideOutline, ShowOutline } from "@makeplane/propel/icons";
// plane imports
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { E_PASSWORD_STRENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { PasswordStrengthIndicator } from "@plane/blocks/auth";
import { getPasswordStrength } from "@plane/utils";
// components
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
// helpers
import { authErrorHandler, EAuthenticationErrorCodes, passwordErrors } from "@/helpers/authentication.helper";
// hooks
import { useUser } from "@/hooks/store/user";
import { usePasswordManagement } from "@/hooks/use-password-management";
// services
import { AuthService } from "@/services/auth.service";

export interface FormValues {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

const defaultValues: FormValues = {
  old_password: "",
  new_password: "",
  confirm_password: "",
};

const authService = new AuthService();

const defaultShowPassword = {
  oldPassword: false,
  password: false,
  confirmPassword: false,
};

type Translate = ReturnType<typeof useTranslation>["t"];

function isSameAsOldPassword(oldPassword: string, password: string) {
  return oldPassword !== "" && password !== "" && password === oldPassword;
}

function getIsButtonDisabled(args: {
  password: string;
  confirmPassword: string;
  oldPassword: string;
  oldPasswordRequired: boolean;
}) {
  const { password, confirmPassword, oldPassword, oldPasswordRequired } = args;
  if (getPasswordStrength(password) !== E_PASSWORD_STRENGTH.STRENGTH_VALID) return true;
  if (oldPasswordRequired && oldPassword.trim() === "") return true;
  if (password.trim() === "") return true;
  if (confirmPassword.trim() === "") return true;
  if (password !== confirmPassword) return true;
  return password === oldPassword;
}

function isPasswordMatchVisible(isRetryFocused: boolean, confirmPassword: string, password: string) {
  return !isRetryFocused || confirmPassword.length >= password.length;
}

function shouldSetPasswordFieldError(code: string | undefined) {
  return Boolean(code && passwordErrors.includes(code as EAuthenticationErrorCodes));
}

function getPasswordChangeError(error: unknown, t: Translate) {
  const err = error as Error & { error_code?: string };
  const code = err.error_code?.toString();
  const errorInfo = code ? authErrorHandler(code as EAuthenticationErrorCodes) : undefined;
  return {
    code,
    title: errorInfo?.title ?? t("auth.common.password.toast.change_password.error.title"),
    message:
      typeof errorInfo?.message === "string"
        ? errorInfo.message
        : t("auth.common.password.toast.change_password.error.message"),
    fieldMessage: errorInfo?.message?.toString() || t("auth.common.password.toast.change_password.error.message"),
  };
}

function PasswordSupport({ password, isFocused }: { password: string; isFocused: boolean }) {
  if (password.length === 0) return null;
  if (getPasswordStrength(password) === E_PASSWORD_STRENGTH.STRENGTH_VALID) return null;
  return <PasswordStrengthIndicator password={password} isFocused={isFocused} />;
}

function PasswordField({
  control,
  name,
  id,
  placeholder,
  autoComplete,
  visible,
  onToggle,
  error,
  onFocus,
  onBlur,
}: {
  control: Control<FormValues>;
  name: keyof FormValues;
  id: string;
  placeholder: string;
  autoComplete: string;
  visible: boolean;
  onToggle: () => void;
  error: string | undefined;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      rules={{
        required: t("common.errors.required"),
      }}
      render={({ field: { value, onChange } }) => (
        <Field name={id} invalid={Boolean(error)}>
          <InputGroup size="lg">
            <Input
              size="lg"
              id={id}
              type={visible ? "text" : "password"}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              onFocus={onFocus}
              onBlur={onBlur}
              autoComplete={autoComplete}
            />
            <button
              type="button"
              className="grid size-5 place-items-center"
              onClick={onToggle}
              aria-label={visible ? t("web.hide_password") : t("web.show_password")}
            >
              {visible ? (
                <HideOutline className="size-5 text-placeholder" />
              ) : (
                <ShowOutline className="size-5 text-placeholder" />
              )}
            </button>
          </InputGroup>
        </Field>
      )}
    />
  );
}

export const SecurityProfileSettings = observer(function SecurityProfileSettings() {
  // store
  const { data: currentUser, changePassword } = useUser();
  const { canManagePassword, isLoading: isPasswordManagementLoading } = usePasswordManagement();
  // states
  const [showPassword, setShowPassword] = useState(defaultShowPassword);
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);

  // use form
  const {
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ defaultValues });
  // derived values
  const oldPassword = watch("old_password");
  const password = watch("new_password");
  const confirmPassword = watch("confirm_password");
  const oldPasswordRequired = !currentUser?.is_password_autoset;
  // i18n
  const { t } = useTranslation();

  const isNewPasswordSameAsOldPassword = isSameAsOldPassword(oldPassword, password);

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleChangePassword = async (formData: FormValues) => {
    const { old_password, new_password } = formData;
    try {
      const csrfToken = await authService.requestCSRFToken().then((data) => data?.csrf_token);
      if (!csrfToken) throw new Error("csrf token not found");

      await changePassword(csrfToken, {
        ...(oldPasswordRequired && { old_password }),
        new_password,
      });

      reset(defaultValues);
      setShowPassword(defaultShowPassword);
      setToast({
        type: "success",
        title: t("auth.common.password.toast.change_password.success.title"),
        message: t("auth.common.password.toast.change_password.success.message"),
      });
    } catch (error: unknown) {
      const failure = getPasswordChangeError(error, t);

      setToast({
        type: "error",
        title: failure.title,
        message: failure.message,
      });

      if (shouldSetPasswordFieldError(failure.code)) {
        setError("new_password", {
          type: "manual",
          message: failure.fieldMessage,
        });
      }
    }
  };

  const isButtonDisabled = getIsButtonDisabled({
    password,
    confirmPassword,
    oldPassword,
    oldPasswordRequired,
  });

  const renderPasswordMatchError = isPasswordMatchVisible(isRetryPasswordInputFocused, confirmPassword, password);

  if (isPasswordManagementLoading) return null;

  // Reached through a stale link or tab: explain instead of offering a form the API rejects
  if (!canManagePassword)
    return (
      <div className="size-full">
        <ProfileSettingsHeading title={t("auth.common.password.change_password.label.default")} />
        <p className="mt-7 text-13 text-tertiary">{t("web.password_login_disabled_notice")}</p>
      </div>
    );

  return (
    <div className="size-full">
      <ProfileSettingsHeading title={t("auth.common.password.change_password.label.default")} />
      <form onSubmit={handleSubmit(handleChangePassword)} className="mt-7 flex flex-col gap-8">
        <div className="flex flex-col gap-y-7">
          {oldPasswordRequired && (
            <div className="flex flex-col gap-y-2">
              <h4 className="text-13">{t("auth.common.password.current_password.label")}</h4>
              <PasswordField
                control={control}
                name="old_password"
                id="old_password"
                placeholder={t("old_password")}
                autoComplete="current-password"
                visible={showPassword.oldPassword}
                onToggle={() => handleShowPassword("oldPassword")}
                error={errors.old_password?.message}
              />
              {errors.old_password && (
                <span className="text-11 text-danger-primary">{errors.old_password.message}</span>
              )}
            </div>
          )}
          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2">
            <div className="flex flex-col gap-y-2">
              <h4 className="text-13">{t("auth.common.password.new_password.label")}</h4>
              <PasswordField
                control={control}
                name="new_password"
                id="new_password"
                placeholder={t("auth.common.password.new_password.placeholder")}
                autoComplete="new-password"
                visible={showPassword.password}
                onToggle={() => handleShowPassword("password")}
                error={errors.new_password?.message}
                onFocus={() => setIsPasswordInputFocused(true)}
                onBlur={() => setIsPasswordInputFocused(false)}
              />
              <PasswordSupport password={password} isFocused={isPasswordInputFocused} />
              {errors.new_password && (
                <span className="text-11 text-danger-primary">{errors.new_password.message}</span>
              )}
              {isNewPasswordSameAsOldPassword && !isPasswordInputFocused && (
                <span className="text-11 text-danger-primary">
                  {t("new_password_must_be_different_from_old_password")}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-y-2">
              <h4 className="text-13">{t("auth.common.password.confirm_password.label")}</h4>
              <PasswordField
                control={control}
                name="confirm_password"
                id="confirm_password"
                placeholder={t("auth.common.password.confirm_password.placeholder")}
                autoComplete="new-password"
                visible={showPassword.confirmPassword}
                onToggle={() => handleShowPassword("confirmPassword")}
                error={errors.confirm_password?.message}
                onFocus={() => setIsRetryPasswordInputFocused(true)}
                onBlur={() => setIsRetryPasswordInputFocused(false)}
              />
              {!!confirmPassword && password !== confirmPassword && renderPasswordMatchError && (
                <span className="text-13 text-danger-primary">{t("auth.common.password.errors.match")}</span>
              )}
            </div>
          </div>
          <div>
            <Button
              variant="primary"
              size="lg"
              stretch="auto"
              type="submit"
              label={
                isSubmitting
                  ? t("auth.common.password.change_password.label.submitting")
                  : t("auth.common.password.change_password.label.default")
              }
              loading={isSubmitting}
              disabled={isButtonDisabled}
            />
          </div>
        </div>
      </form>
    </div>
  );
});
