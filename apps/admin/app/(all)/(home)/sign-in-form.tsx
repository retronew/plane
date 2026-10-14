/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import { HideOutline, LockOutline, ShowOutline } from "@makeplane/propel/icons";
// plane internal packages
import type { EAdminAuthErrorCodes, TAdminAuthErrorInfo } from "@plane/constants";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { OAuthOptions } from "@plane/blocks/auth";
import { AuthService } from "@plane/services";
// components
import { Banner } from "@/components/common/banner";
// local components
import { FormHeader } from "@/components/instance/form-header";
import { useInstance } from "@/hooks/store";
import { AuthBanner } from "./auth-banner";
import { AuthHeader } from "./auth-header";
import { authErrorHandler } from "./auth-helpers";

// service initialization
const authService = new AuthService();

// Falls back to the generic lock icon when no icon is configured or it fails to load
function OIDCProviderIcon({ iconUrl }: { iconUrl?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);
  if (!iconUrl || failedUrl === iconUrl) return <LockOutline className="size-[18px] text-secondary" />;
  return (
    <img
      src={iconUrl}
      height={18}
      width={18}
      className="size-[18px] rounded-sm object-contain"
      alt=""
      onError={() => setFailedUrl(iconUrl)}
    />
  );
}

// error codes
enum EErrorCodes {
  INSTANCE_NOT_CONFIGURED = "INSTANCE_NOT_CONFIGURED",
  REQUIRED_EMAIL_PASSWORD = "REQUIRED_EMAIL_PASSWORD",
  INVALID_EMAIL = "INVALID_EMAIL",
  USER_DOES_NOT_EXIST = "USER_DOES_NOT_EXIST",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
}

type TError = {
  type: EErrorCodes | undefined;
  message: string | undefined;
};

// form data
type TFormData = {
  email: string;
  password: string;
};

const defaultFromData: TFormData = {
  email: "",
  password: "",
};

export const InstanceSignInForm = observer(function InstanceSignInForm() {
  const { t } = useTranslation();
  // search params
  const searchParams = useSearchParams();
  const { config } = useInstance();
  const isOIDCEnabled = !!config?.is_oidc_enabled;
  const emailParam = searchParams.get("email") || undefined;
  const errorCode = searchParams.get("error_code") || undefined;
  const errorMessage = searchParams.get("error_message") || undefined;
  // state
  const [showPassword, setShowPassword] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<TFormData>(defaultFromData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<TAdminAuthErrorInfo | undefined>(undefined);

  const handleFormChange = (key: keyof TFormData, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (csrfToken === undefined)
      authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
  }, [csrfToken]);

  useEffect(() => {
    if (emailParam) setFormData((prev) => ({ ...prev, email: emailParam }));
  }, [emailParam]);

  // derived values
  const errorData: TError = useMemo(() => {
    if (errorCode && errorMessage) {
      switch (errorCode) {
        case EErrorCodes.INSTANCE_NOT_CONFIGURED:
          return { type: EErrorCodes.INSTANCE_NOT_CONFIGURED, message: errorMessage };
        case EErrorCodes.REQUIRED_EMAIL_PASSWORD:
          return { type: EErrorCodes.REQUIRED_EMAIL_PASSWORD, message: errorMessage };
        case EErrorCodes.INVALID_EMAIL:
          return { type: EErrorCodes.INVALID_EMAIL, message: errorMessage };
        case EErrorCodes.USER_DOES_NOT_EXIST:
          return { type: EErrorCodes.USER_DOES_NOT_EXIST, message: errorMessage };
        case EErrorCodes.AUTHENTICATION_FAILED:
          return { type: EErrorCodes.AUTHENTICATION_FAILED, message: errorMessage };
        default:
          return { type: undefined, message: undefined };
      }
    } else return { type: undefined, message: undefined };
  }, [errorCode, errorMessage]);

  const isButtonDisabled = useMemo(
    () => !(!isSubmitting && formData.email && formData.password),
    [formData.email, formData.password, isSubmitting]
  );

  useEffect(() => {
    if (errorCode) {
      const errorDetail = authErrorHandler(errorCode?.toString() as EAdminAuthErrorCodes, t);
      if (errorDetail) {
        setErrorInfo(errorDetail);
      }
    }
  }, [errorCode, t]);

  return (
    <>
      <AuthHeader />
      <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
        <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
          <FormHeader heading={t("admin.sign_in.heading")} subHeading={t("admin.sign_in.sub_heading")} />
          {isOIDCEnabled && (
            <>
              <OAuthOptions
                showDivider={false}
                options={[
                  {
                    id: "oidc",
                    text: t("admin.sign_in.sso", { provider: config?.oidc_provider_name || "OIDC" }),
                    icon: <OIDCProviderIcon iconUrl={config?.oidc_provider_icon_url} />,
                    onClick: () => window.location.assign(`${API_BASE_URL}/api/instances/admins/oidc/`),
                  },
                ]}
              />
              <div className="flex items-center">
                <hr className="w-full border-strong" />
                <p className="mx-3 shrink-0 text-11 text-placeholder">{t("admin.sign_in.sso_divider")}</p>
                <hr className="w-full border-strong" />
              </div>
            </>
          )}
          <form
            className="space-y-4"
            method="POST"
            action={`${API_BASE_URL}/api/instances/admins/sign-in/`}
            onSubmit={() => setIsSubmitting(true)}
          >
            {errorData.type && errorData?.message ? (
              <Banner type="error" message={errorData?.message} />
            ) : (
              <>{errorInfo && <AuthBanner bannerData={errorInfo} handleBannerData={setErrorInfo} />}</>
            )}
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />

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
                  autoComplete="off"
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- first field of the sign-in form
                  autoFocus
                />
              </InputGroup>
            </div>

            <div className="w-full space-y-1">
              <label className="text-13 font-medium text-tertiary" htmlFor="password">
                {t("admin.common.password")} <span className="text-danger-primary">*</span>
              </label>
              <InputGroup size="lg">
                <Input
                  size="lg"
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("admin.sign_in.password_placeholder")}
                  value={formData.password}
                  onChange={(e) => handleFormChange("password", e.target.value)}
                  autoComplete="off"
                />
                {showPassword ? (
                  <button
                    type="button"
                    aria-label={t("admin.common.hide_password")}
                    className="flex items-center justify-center text-placeholder"
                    onClick={() => setShowPassword(false)}
                  >
                    <HideOutline className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={t("admin.common.show_password")}
                    className="flex items-center justify-center text-placeholder"
                    onClick={() => setShowPassword(true)}
                  >
                    <ShowOutline className="h-4 w-4" />
                  </button>
                )}
              </InputGroup>
            </div>
            <div className="py-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                stretch="full"
                disabled={isButtonDisabled}
                loading={isSubmitting}
                label={t("admin.sign_in.submit")}
              />
            </div>
          </form>
        </div>
      </div>
    </>
  );
});
