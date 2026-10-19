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
import type { TTranslationStore } from "@plane/i18n";
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

type TSearchParams = { get: (key: string) => string | null } | null | undefined;

const getSearchParam = (searchParams: TSearchParams, key: string) => searchParams?.get(key) || undefined;

const getInitialFormData = (searchParams: TSearchParams): TFormData => ({
  ...defaultFromData,
  first_name: getSearchParam(searchParams, "first_name") ?? "",
  last_name: getSearchParam(searchParams, "last_name") ?? "",
  company_name: getSearchParam(searchParams, "company") ?? "",
  email: getSearchParam(searchParams, "email") ?? "",
});

const getErrorData = (
  errorCode: string | undefined,
  errorMessage: string | undefined,
  t: TTranslationStore["t"]
): TError => {
  if (!errorCode) return { type: undefined, message: undefined };
  const known = ERROR_CODE_MAP[errorCode];
  if (known) return { type: known.type, message: t(known.message) };
  return {
    type: EErrorCodes.BANNER,
    message: errorMessage
      ? t("admin.setup.errors.unknown_with_detail", { detail: errorMessage })
      : t("admin.common.something_went_wrong"),
  };
};

const getIsSubmitDisabled = (formData: TFormData, isSubmitting: boolean) =>
  !(
    !isSubmitting &&
    formData.first_name &&
    formData.email &&
    formData.password &&
    getPasswordStrength(formData.password) === E_PASSWORD_STRENGTH.STRENGTH_VALID &&
    formData.password === formData.confirm_password
  );

const isPersonNameAllowed = (value: string) => validatePersonName(value) === true || value === "";
const isCompanyNameAllowed = (value: string) => validateCompanyName(value, false) === true || value === "";

function SetupErrorBanner({ errorData }: { errorData: TError }) {
  const isInlineError = errorData.type === EErrorCodes.INVALID_EMAIL || errorData.type === EErrorCodes.INVALID_PASSWORD;

  if (!errorData.type || !errorData.message || isInlineError) return null;

  return <Banner type="error" message={errorData.message} />;
}

function PasswordVisibilityButton(props: {
  isVisible: boolean;
  showLabel: string;
  hideLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={props.isVisible ? props.hideLabel : props.showLabel}
      className="flex items-center justify-center text-placeholder"
      onClick={props.onToggle}
    >
      {props.isVisible ? <HideOutline className="h-4 w-4" /> : <ShowOutline className="h-4 w-4" />}
    </button>
  );
}

function NameFields(props: {
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
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
            value={props.firstName}
            onChange={(e) => {
              if (isPersonNameAllowed(e.target.value)) props.onFirstNameChange(e.target.value);
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
            value={props.lastName}
            onChange={(e) => {
              if (isPersonNameAllowed(e.target.value)) props.onLastNameChange(e.target.value);
            }}
            autoComplete="off"
            maxLength={50}
          />
        </InputGroup>
      </div>
    </div>
  );
}

function EmailField(props: { value: string; errorData: TError; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const isInvalid = props.errorData.type === EErrorCodes.INVALID_EMAIL;

  return (
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
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={isInvalid}
          autoComplete="off"
        />
      </InputGroup>
      {isInvalid && props.errorData.message && (
        <p className="px-1 text-11 text-danger-primary">{props.errorData.message}</p>
      )}
    </div>
  );
}

function CompanyNameField(props: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();

  return (
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
          value={props.value}
          onChange={(e) => {
            if (isCompanyNameAllowed(e.target.value)) props.onChange(e.target.value);
          }}
          maxLength={80}
        />
      </InputGroup>
    </div>
  );
}

function PasswordField(props: {
  value: string;
  isVisible: boolean;
  isFocused: boolean;
  errorData: TError;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation();
  const isInvalid = props.errorData.type === EErrorCodes.INVALID_PASSWORD;

  return (
    <div className="w-full space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor="password">
        {t("admin.setup.set_password")} <span className="text-danger-primary">*</span>
      </label>
      <InputGroup size="lg">
        <Input
          size="lg"
          id="password"
          name="password"
          type={props.isVisible ? "text" : "password"}
          placeholder={t("admin.setup.new_password")}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={isInvalid}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          autoComplete="new-password"
        />
        <PasswordVisibilityButton
          isVisible={props.isVisible}
          showLabel={t("admin.common.show_password")}
          hideLabel={t("admin.common.hide_password")}
          onToggle={props.onToggleVisibility}
        />
      </InputGroup>
      {isInvalid && props.errorData.message && (
        <p className="px-1 text-11 text-danger-primary">{props.errorData.message}</p>
      )}
      <PasswordStrengthIndicator password={props.value} isFocused={props.isFocused} />
    </div>
  );
}

function ConfirmPasswordField(props: {
  value: string;
  password: string;
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
    <div className="w-full space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor="confirm_password">
        {t("admin.setup.confirm_password")} <span className="text-danger-primary">*</span>
      </label>
      <InputGroup size="lg">
        <Input
          size="lg"
          type={props.isVisible ? "text" : "password"}
          id="confirm_password"
          name="confirm_password"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={t("admin.setup.confirm_password")}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          autoComplete="new-password"
        />
        <PasswordVisibilityButton
          isVisible={props.isVisible}
          showLabel={t("admin.common.show_password")}
          hideLabel={t("admin.common.hide_password")}
          onToggle={props.onToggleVisibility}
        />
      </InputGroup>
      {!!props.value && props.password !== props.value && shouldShowMatchError && (
        <span className="text-13 text-danger-primary">{t("admin.setup.passwords_dont_match")}</span>
      )}
    </div>
  );
}

export function InstanceSetupForm() {
  const { t } = useTranslation();
  // search params
  const searchParams = useSearchParams();
  const errorCode = getSearchParam(searchParams, "error_code");
  const errorMessage = getSearchParam(searchParams, "error_message");
  // state
  const [showPassword, setShowPassword] = useState({
    password: false,
    retypePassword: false,
  });
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<TFormData>(() => getInitialFormData(searchParams));
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
  const errorData: TError = useMemo(() => getErrorData(errorCode, errorMessage, t), [errorCode, errorMessage, t]);

  const isButtonDisabled = useMemo(() => getIsSubmitDisabled(formData, isSubmitting), [formData, isSubmitting]);

  return (
    <>
      <AuthHeader />
      <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
        <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
          <FormHeader heading={t("admin.setup.heading")} subHeading={t("admin.setup.sub_heading")} />
          <SetupErrorBanner errorData={errorData} />
          <form
            className="space-y-4"
            method="POST"
            action={`${API_BASE_URL}/api/instances/admins/sign-up/`}
            onSubmit={() => setIsSubmitting(true)}
          >
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken ?? ""} />

            <NameFields
              firstName={formData.first_name}
              lastName={formData.last_name}
              onFirstNameChange={(value) => handleFormChange("first_name", value)}
              onLastNameChange={(value) => handleFormChange("last_name", value)}
            />

            <EmailField
              value={formData.email}
              errorData={errorData}
              onChange={(value) => handleFormChange("email", value)}
            />

            <CompanyNameField
              value={formData.company_name}
              onChange={(value) => handleFormChange("company_name", value)}
            />

            <PasswordField
              value={formData.password}
              isVisible={showPassword.password}
              isFocused={isPasswordInputFocused}
              errorData={errorData}
              onChange={(value) => handleFormChange("password", value)}
              onToggleVisibility={() => handleShowPassword("password")}
              onFocus={() => setIsPasswordInputFocused(true)}
              onBlur={() => setIsPasswordInputFocused(false)}
            />

            <ConfirmPasswordField
              value={formData.confirm_password ?? ""}
              password={formData.password}
              isVisible={showPassword.retypePassword}
              isFocused={isRetryPasswordInputFocused}
              onChange={(value) => handleFormChange("confirm_password", value)}
              onToggleVisibility={() => handleShowPassword("retypePassword")}
              onFocus={() => setIsRetryPasswordInputFocused(true)}
              onBlur={() => setIsRetryPasswordInputFocused(false)}
            />

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
