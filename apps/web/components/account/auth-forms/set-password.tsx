/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
// plane imports
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { E_PASSWORD_STRENGTH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
// components
import { getPasswordStrength } from "@plane/utils";
// hooks
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// services
import { AuthService } from "@/services/auth.service";
// local components
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

export const SetPasswordForm = observer(function SetPasswordForm() {
  // router
  const router = useAppRouter();
  // search params
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  // states
  const [passwordFormData, setPasswordFormData] = useState<TResetPasswordFormValues>({
    ...defaultValues,
    email: email ? email.toString() : "",
  });
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  // plane hooks
  const { t } = useTranslation();
  // hooks
  const { data: user, handleSetPassword } = useUser();

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

  const handleFormChange = (key: keyof TResetPasswordFormValues, value: string) =>
    setPasswordFormData((prev) => ({ ...prev, [key]: value }));

  const isButtonDisabled = useMemo(
    () =>
      !(
        !!passwordFormData.password &&
        getPasswordStrength(passwordFormData.password) === E_PASSWORD_STRENGTH.STRENGTH_VALID &&
        passwordFormData.password === passwordFormData.confirm_password
      ),
    [passwordFormData]
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    try {
      e.preventDefault();
      if (!csrfToken) throw new Error("csrf token not found");
      await handleSetPassword(csrfToken, { password: passwordFormData.password });
      router.push("/");
    } catch (error: unknown) {
      let message = undefined;
      if (error instanceof Error) {
        const err = error as Error & { error?: string };
        message = err.error;
      }
      setToast({
        type: "error",
        title: t("common.errors.default.title"),
        message: message ?? t("common.errors.default.message"),
      });
    }
  };

  return (
    <FormContainer>
      <AuthFormHeader title={t("web.set_password")} description={t("web.create_a_new_password")} />
      <form className="space-y-4" onSubmit={(e) => handleSubmit(e)}>
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
              value={user?.email ?? ""}
              placeholder={t("auth.common.email.placeholder")}
              autoComplete="off"
              disabled
            />
          </InputGroup>
        </div>
        <PasswordField
          name="password"
          value={passwordFormData.password}
          onChange={(value) => handleFormChange("password", value)}
        />
        <PasswordField
          name="confirm_password"
          value={passwordFormData.confirm_password}
          password={passwordFormData.password}
          onChange={(value) => handleFormChange("confirm_password", value)}
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          stretch="full"
          label={t("common.continue")}
          disabled={isButtonDisabled}
        />
      </form>
    </FormContainer>
  );
});
