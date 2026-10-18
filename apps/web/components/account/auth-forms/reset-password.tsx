/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
// ui
import { Banner } from "@makeplane/propel/components/banner";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { API_BASE_URL, E_PASSWORD_STRENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
// components
import { getPasswordStrength } from "@plane/utils";
// helpers
import type { EAuthenticationErrorCodes, TAuthErrorInfo } from "@/helpers/authentication.helper";
import { EErrorAlertType, authErrorHandler } from "@/helpers/authentication.helper";
// services
import { AuthService } from "@/services/auth.service";
// local imports
import { FormContainer } from "./common/container";
import { AuthFormHeader } from "./common/header";
import { PasswordField } from "./password-field";

type TResetPasswordFormValues = {
  email: string;
  password: string;
  confirm_password: string;
};

const defaultValues: TResetPasswordFormValues = {
  email: "",
  password: "",
  confirm_password: "",
};

// services
const authService = new AuthService();

export const ResetPasswordForm = observer(function ResetPasswordForm() {
  // search params
  const searchParams = useSearchParams();
  const uidb64 = searchParams.get("uidb64");
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const error_code = searchParams.get("error_code");
  // states
  const [resetFormData, setResetFormData] = useState<TResetPasswordFormValues>({
    ...defaultValues,
    email: email ? email.toString() : "",
  });
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [errorInfo, setErrorInfo] = useState<TAuthErrorInfo | undefined>(undefined);
  // plane hooks
  const { t } = useTranslation();

  const handleFormChange = (key: keyof TResetPasswordFormValues, value: string) =>
    setResetFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let active = true;
    authService.requestCSRFToken().then(
      (data) => {
        if (active && data?.csrf_token) setCsrfToken(data.csrf_token);
        return undefined;
      },
      (error: unknown) => {
        console.error("Failed to request CSRF token", error);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const isButtonDisabled = useMemo(
    () =>
      !(
        !!resetFormData.password &&
        getPasswordStrength(resetFormData.password) === E_PASSWORD_STRENGTH.STRENGTH_VALID &&
        resetFormData.password === resetFormData.confirm_password
      ),
    [resetFormData]
  );

  useEffect(() => {
    if (error_code) {
      const errorhandler = authErrorHandler(error_code?.toString() as EAuthenticationErrorCodes);
      if (errorhandler) {
        setErrorInfo(errorhandler);
      }
    }
  }, [error_code]);

  return (
    <FormContainer>
      <AuthFormHeader title={t("web.reset_password")} description={t("web.create_a_new_password")} />

      {errorInfo && errorInfo?.type === EErrorAlertType.BANNER_ALERT && (
        <Banner
          placement="inline"
          variant="accent"
          role="alert"
          description={errorInfo.message}
          dismissLabel={t("close")}
          onDismiss={() => setErrorInfo(undefined)}
        />
      )}
      <form
        className="space-y-4"
        method="POST"
        action={`${API_BASE_URL}/auth/reset-password/${uidb64?.toString()}/${token?.toString()}/`}
      >
        <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken ?? ""} />
        <div className="space-y-1">
          <label className="text-13 font-medium text-tertiary" htmlFor="email">
            {t("auth.common.email.label")}
          </label>
          <InputGroup size="2xl">
            <Input
              size="2xl"
              id="email"
              name="email"
              type="email"
              value={resetFormData.email}
              placeholder={t("auth.common.email.placeholder")}
              autoComplete="off"
              disabled
            />
          </InputGroup>
        </div>
        <PasswordField
          name="password"
          value={resetFormData.password}
          onChange={(value) => handleFormChange("password", value)}
        />
        <PasswordField
          name="confirm_password"
          value={resetFormData.confirm_password}
          password={resetFormData.password}
          onChange={(value) => handleFormChange("confirm_password", value)}
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          stretch="full"
          label={t("auth.common.password.submit")}
          disabled={isButtonDisabled}
        />
      </form>
    </FormContainer>
  );
});
