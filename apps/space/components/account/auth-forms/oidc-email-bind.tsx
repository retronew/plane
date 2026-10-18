/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { TickCircleOutline } from "@makeplane/propel/icons";
import { API_BASE_URL, SPACE_BASE_PATH } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { AuthService } from "@plane/services";
import { checkEmailValidity } from "@plane/utils";
// helpers
import type { TAuthErrorInfo } from "@/helpers/authentication.helper";
import { EAuthenticationErrorCodes, authErrorHandler } from "@/helpers/authentication.helper";
// hooks
import { useTimer } from "@plane/hooks";
// local components
import { AuthBanner } from "./auth-banner";

const authService = new AuthService();

const RESEND_TIMER_SECONDS = 30;

// Full page load: the space home only picks up `error_code` on its initial render
const goToSignIn = (errorCode?: string) =>
  window.location.replace(`${SPACE_BASE_PATH}/${errorCode ? `?error_code=${errorCode}` : ""}`);

export function OIDCEmailBindForm() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  // a wrong code redirects back here with the email and the error
  const emailParam = searchParams.get("email") ?? "";
  const errorCode = searchParams.get("error_code");
  const nextPath = searchParams.get("next_path");
  // states
  const [displayName, setDisplayName] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">(emailParam ? "code" : "email");
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<TAuthErrorInfo | undefined>(
    errorCode ? authErrorHandler(errorCode as EAuthenticationErrorCodes, emailParam) : undefined
  );
  const { timer: resendTimer, setTimer: setResendTimer } = useTimer(0);

  useEffect(() => {
    authService
      .getOIDCEmailBindStatus()
      .then((status) => {
        // Nothing to bind (expired, or opened directly): start the login again
        if (!status.pending) {
          goToSignIn(EAuthenticationErrorCodes.OIDC_EMAIL_BIND_EXPIRED);
          return undefined;
        }
        setDisplayName(status.display_name);
        return undefined;
      })
      .catch(() => goToSignIn());
  }, []);

  useEffect(() => {
    if (step === "code" && csrfToken === undefined)
      authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
  }, [step, csrfToken]);

  const sendCode = async () => {
    setIsSendingCode(true);
    setErrorInfo(undefined);
    try {
      const response = await authService.sendOIDCEmailBindCode({ email });
      setEmail(response.email);
      setCode("");
      setStep("code");
      setResendTimer(RESEND_TIMER_SECONDS);
    } catch (error) {
      const errorhandler = authErrorHandler(
        (error as { error_code?: number } | undefined)?.error_code?.toString() as EAuthenticationErrorCodes,
        email
      );
      if (errorhandler?.code === EAuthenticationErrorCodes.OIDC_EMAIL_BIND_EXPIRED) {
        goToSignIn(errorhandler.code);
        return;
      }
      setErrorInfo(errorhandler);
    } finally {
      setIsSendingCode(false);
    }
  };

  const isEmailValid = checkEmailValidity(email);

  return (
    <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
      <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
        <AuthBanner bannerData={errorInfo} handleBannerData={setErrorInfo} />
        <div className="flex flex-col gap-1">
          <span className="text-20 font-semibold text-primary">{t("web.oidc_email_bind.title")}</span>
          <span className="text-20 font-semibold text-placeholder">
            {displayName
              ? t("web.oidc_email_bind.description_with_name", { name: displayName })
              : t("web.oidc_email_bind.description")}
          </span>
        </div>
        {step === "email" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (isEmailValid) void sendCode();
            }}
          >
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.common.email.placeholder")}
                  autoComplete="off"
                />
              </InputGroup>
              <p className="px-1 pt-1 text-11 text-tertiary">{t("web.oidc_email_bind.email_hint")}</p>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              stretch="full"
              disabled={!isEmailValid || isSendingCode}
              loading={isSendingCode}
              label={t("web.oidc_email_bind.send_code")}
            />
          </form>
        ) : (
          <form
            className="space-y-4"
            method="POST"
            action={`${API_BASE_URL}/auth/oidc/bind-email/`}
            onSubmit={() => setIsSubmitting(true)}
          >
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken ?? ""} />
            <input type="hidden" name="email" value={email} />
            {nextPath && <input type="hidden" name="next_path" value={nextPath} />}
            <div className="space-y-1">
              <label htmlFor="bind-email" className="text-13 font-medium text-tertiary">
                {t("auth.common.email.label")}
              </label>
              <InputGroup size="2xl">
                <Input size="2xl" id="bind-email" type="email" value={email} disabled />
              </InputGroup>
              <div className="flex w-full justify-end px-1 pt-1 text-11">
                <button
                  type="button"
                  className="font-medium text-accent-secondary"
                  onClick={() => {
                    setErrorInfo(undefined);
                    setStep("email");
                  }}
                >
                  {t("web.oidc_email_bind.change_email")}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="unique-code" className="text-13 font-medium text-tertiary">
                {t("auth.common.unique_code.label")}
              </label>
              <InputGroup size="2xl">
                <Input
                  size="2xl"
                  id="unique-code"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("auth.common.unique_code.placeholder")}
                  autoComplete="one-time-code"
                />
              </InputGroup>
              <div className="flex w-full items-center justify-between px-1 pt-1 text-11">
                <p className="flex items-center gap-1 font-medium text-success-primary">
                  <TickCircleOutline height={12} width={12} />
                  {t("auth.common.unique_code.paste_code")}
                </p>
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  className={
                    isSendingCode || resendTimer > 0 ? "text-placeholder" : "font-medium text-accent-secondary"
                  }
                  disabled={isSendingCode || resendTimer > 0}
                >
                  {resendTimer > 0
                    ? t("auth.common.resend_in", { seconds: resendTimer })
                    : isSendingCode
                      ? t("auth.common.unique_code.requesting_new_code")
                      : t("common.resend")}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              stretch="full"
              disabled={!code || !csrfToken || isSubmitting}
              loading={isSubmitting}
              label={t("common.continue")}
            />
          </form>
        )}
        <div className="flex h-7 items-center justify-center">
          <button type="button" className="text-13 font-medium text-accent-primary" onClick={() => goToSignIn()}>
            {t("auth.common.back_to_sign_in")}
          </button>
        </div>
      </div>
    </div>
  );
}
