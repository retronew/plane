/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
// icons
import { HideOutline, ShowOutline } from "@makeplane/propel/icons";
// plane internal packages
import { API_BASE_URL, E_PASSWORD_STRENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { AuthService } from "@plane/services";
import { getPasswordStrength, validatePersonName, validateCompanyName } from "@plane/utils";
// components
import { AuthHeader } from "@/app/(all)/(home)/auth-header";
import { PasswordStrengthIndicator } from "@/components/common/password-strength-indicator";
import { Banner } from "../common/banner";
import { FormHeader } from "./form-header";

// service initialization
const authService = new AuthService();

// error codes
enum EErrorCodes {
  INSTANCE_NOT_CONFIGURED = "INSTANCE_NOT_CONFIGURED",
  INVALID_EMAIL = "INVALID_EMAIL",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  BANNER = "BANNER",
}

type TError = {
  type: EErrorCodes | undefined;
  message: string | undefined;
};

// backend returns numeric codes; messages are translation keys (see AUTHENTICATION_ERROR_CODES in apps/api/plane/authentication/adapter/error.py)
const ERROR_CODE_MAP: Record<string, { type: EErrorCodes; message: string }> = {
  "5000": { type: EErrorCodes.INSTANCE_NOT_CONFIGURED, message: "admin.setup.errors.instance_not_configured" },
  "5021": { type: EErrorCodes.INVALID_PASSWORD, message: "admin.setup.errors.password_too_weak" },
  "5150": { type: EErrorCodes.BANNER, message: "admin.setup.errors.admin_already_exist" },
  "5155": { type: EErrorCodes.BANNER, message: "admin.setup.errors.required_fields" },
  "5160": { type: EErrorCodes.INVALID_EMAIL, message: "admin.setup.errors.invalid_email" },
  "5180": { type: EErrorCodes.BANNER, message: "admin.setup.errors.admin_user_already_exist" },
};

// form data
type TFormData = {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  password: string;
  confirm_password?: string;
};

const defaultFromData: TFormData = {
  first_name: "",
  last_name: "",
  email: "",
  company_name: "",
  password: "",
};

export function InstanceSetupForm() {
  const { t } = useTranslation();
  // search params
  const searchParams = useSearchParams();
  const firstNameParam = searchParams?.get("first_name") || undefined;
  const lastNameParam = searchParams?.get("last_name") || undefined;
  const companyParam = searchParams?.get("company") || undefined;
  const emailParam = searchParams?.get("email") || undefined;
  const errorCode = searchParams?.get("error_code") || undefined;
  const errorMessage = searchParams?.get("error_message") || undefined;
  // state
  const [showPassword, setShowPassword] = useState({
    password: false,
    retypePassword: false,
  });
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<TFormData>(() => ({
    ...defaultFromData,
    first_name: firstNameParam ?? "",
    last_name: lastNameParam ?? "",
    company_name: companyParam ?? "",
    email: emailParam ?? "",
  }));
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryPasswordInputFocused, setIsRetryPasswordInputFocused] = useState(false);

  const handleShowPassword = (key: keyof typeof showPassword) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleFormChange = (key: keyof TFormData, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (csrfToken === undefined)
      authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
  }, [csrfToken]);

  // derived values
  const errorData: TError = useMemo(() => {
    if (!errorCode) return { type: undefined, message: undefined };
    const known = ERROR_CODE_MAP[errorCode];
    if (known) return { type: known.type, message: t(known.message) };
    return {
      type: EErrorCodes.BANNER,
      message: errorMessage
        ? t("admin.setup.errors.unknown_with_detail", { detail: errorMessage })
        : t("admin.common.something_went_wrong"),
    };
  }, [errorCode, errorMessage, t]);

  const isButtonDisabled = useMemo(
    () =>
      !(
        !isSubmitting &&
        formData.first_name &&
        formData.email &&
        formData.password &&
        getPasswordStrength(formData.password) === E_PASSWORD_STRENGTH.STRENGTH_VALID &&
        formData.password === formData.confirm_password
      ),
    [formData.confirm_password, formData.email, formData.first_name, formData.password, isSubmitting]
  );

  const password = formData?.password ?? "";
  const confirmPassword = formData?.confirm_password ?? "";
  const renderPasswordMatchError = !isRetryPasswordInputFocused || confirmPassword.length >= password.length;

  return (
    <>
      <AuthHeader />
      <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
        <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
          <FormHeader heading={t("admin.setup.heading")} subHeading={t("admin.setup.sub_heading")} />
          {errorData.type &&
            errorData?.message &&
            ![EErrorCodes.INVALID_EMAIL, EErrorCodes.INVALID_PASSWORD].includes(errorData.type) && (
              <Banner type="error" message={errorData?.message} />
            )}
          <form
            className="space-y-4"
            method="POST"
            action={`${API_BASE_URL}/api/instances/admins/sign-up/`}
            onSubmit={() => setIsSubmitting(true)}
          >
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken ?? ""} />

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="w-full min-w-0 space-y-1">
                <label className="text-13 font-medium text-tertiary" htmlFor="first_name">
                  {t("admin.setup.first_name")} <span className="text-danger-primary">*</span>
                </label>
                <InputGroup size="lg">
                  <Input
                    size="lg"
                    id="first_name"
                    name="first_name"
                    type="text"
                    placeholder={t("admin.setup.first_name_placeholder")}
                    value={formData.first_name}
                    onChange={(e) => {
                      const validation = validatePersonName(e.target.value);
                      if (validation === true || e.target.value === "") {
                        handleFormChange("first_name", e.target.value);
                      }
                    }}
                    autoComplete="off"
                    // oxlint-disable-next-line jsx-a11y/no-autofocus -- first field of the setup form
                    autoFocus
                    maxLength={50}
                  />
                </InputGroup>
              </div>
              <div className="w-full min-w-0 space-y-1">
                <label className="text-13 font-medium text-tertiary" htmlFor="last_name">
                  {t("admin.setup.last_name")} <span className="text-danger-primary">*</span>
                </label>
                <InputGroup size="lg">
                  <Input
                    size="lg"
                    id="last_name"
                    name="last_name"
                    type="text"
                    placeholder={t("admin.setup.last_name_placeholder")}
                    value={formData.last_name}
                    onChange={(e) => {
                      const validation = validatePersonName(e.target.value);
                      if (validation === true || e.target.value === "") {
                        handleFormChange("last_name", e.target.value);
                      }
                    }}
                    autoComplete="off"
                    maxLength={50}
                  />
                </InputGroup>
              </div>
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="email">
                {t("admin.common.email")} <span className="text-danger-primary">*</span>
              </label>
              <InputGroup size="lg">
                <Input
                  size="lg"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => handleFormChange("email", e.target.value)}
                  aria-invalid={errorData.type === EErrorCodes.INVALID_EMAIL}
                  autoComplete="off"
                />
              </InputGroup>
              {errorData.type && errorData.type === EErrorCodes.INVALID_EMAIL && errorData.message && (
                <p className="px-1 text-11 text-danger-primary">{errorData.message}</p>
              )}
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="company_name">
                {t("admin.setup.company_name")} <span className="text-danger-primary">*</span>
              </label>
              <InputGroup size="lg">
                <Input
                  size="lg"
                  id="company_name"
                  name="company_name"
                  type="text"
                  placeholder={t("admin.setup.company_name")}
                  value={formData.company_name}
                  onChange={(e) => {
                    const validation = validateCompanyName(e.target.value, false);
                    if (validation === true || e.target.value === "") {
                      handleFormChange("company_name", e.target.value);
                    }
                  }}
                  maxLength={80}
                />
              </InputGroup>
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="password">
                {t("admin.setup.set_password")} <span className="text-danger-primary">*</span>
              </label>
              <InputGroup size="lg">
                <Input
                  size="lg"
                  id="password"
                  name="password"
                  type={showPassword.password ? "text" : "password"}
                  placeholder={t("admin.setup.new_password")}
                  value={formData.password}
                  onChange={(e) => handleFormChange("password", e.target.value)}
                  aria-invalid={errorData.type === EErrorCodes.INVALID_PASSWORD}
                  onFocus={() => setIsPasswordInputFocused(true)}
                  onBlur={() => setIsPasswordInputFocused(false)}
                  autoComplete="new-password"
                />
                {showPassword.password ? (
                  <button
                    type="button"
                    aria-label={t("admin.common.hide_password")}
                    className="flex items-center justify-center text-placeholder"
                    onClick={() => handleShowPassword("password")}
                  >
                    <HideOutline className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={t("admin.common.show_password")}
                    className="flex items-center justify-center text-placeholder"
                    onClick={() => handleShowPassword("password")}
                  >
                    <ShowOutline className="h-4 w-4" />
                  </button>
                )}
              </InputGroup>
              {errorData.type && errorData.type === EErrorCodes.INVALID_PASSWORD && errorData.message && (
                <p className="px-1 text-11 text-danger-primary">{errorData.message}</p>
              )}
              <PasswordStrengthIndicator password={formData.password} isFocused={isPasswordInputFocused} />
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="confirm_password">
                {t("admin.setup.confirm_password")} <span className="text-danger-primary">*</span>
              </label>
              <InputGroup size="lg">
                <Input
                  size="lg"
                  type={showPassword.retypePassword ? "text" : "password"}
                  id="confirm_password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={(e) => handleFormChange("confirm_password", e.target.value)}
                  placeholder={t("admin.setup.confirm_password")}
                  onFocus={() => setIsRetryPasswordInputFocused(true)}
                  onBlur={() => setIsRetryPasswordInputFocused(false)}
                  autoComplete="new-password"
                />
                {showPassword.retypePassword ? (
                  <button
                    type="button"
                    aria-label={t("admin.common.hide_password")}
                    className="flex items-center justify-center text-placeholder"
                    onClick={() => handleShowPassword("retypePassword")}
                  >
                    <HideOutline className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={t("admin.common.show_password")}
                    className="flex items-center justify-center text-placeholder"
                    onClick={() => handleShowPassword("retypePassword")}
                  >
                    <ShowOutline className="h-4 w-4" />
                  </button>
                )}
              </InputGroup>
              {!!formData.confirm_password &&
                formData.password !== formData.confirm_password &&
                renderPasswordMatchError && (
                  <span className="text-13 text-danger-primary">{t("admin.setup.passwords_dont_match")}</span>
                )}
            </div>

            <div className="py-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                stretch="full"
                disabled={isButtonDisabled}
                loading={isSubmitting}
                label={t("admin.setup.continue")}
              />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
