/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { AuthService } from "@plane/services";
// components
import { ChangeEmailModal } from "@/components/core/modals/change-email-modal";
// helpers
import type { EAuthenticationErrorCodes } from "@/helpers/authentication.helper";
import { authErrorHandler } from "@/helpers/authentication.helper";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
import { useAppRouter } from "@/hooks/use-app-router";

const authService = new AuthService();

/**
 * Links the signed-in account to the instance's OIDC identity provider, so
 * accounts created before SSO (or with a different email) can sign in with it.
 */
export const ProfileSSOLink = observer(function ProfileSSOLink({ currentEmail }: { currentEmail: string }) {
  const { t } = useTranslation();
  const { config } = useInstance();
  const searchParams = useSearchParams();
  const router = useAppRouter();
  const isOIDCEnabled = !!config?.is_oidc_enabled;
  const providerName = config?.oidc_provider_name || "OIDC";
  // the IdP email, offered when it differs from the account email
  const [suggestedEmail, setSuggestedEmail] = useState<string | undefined>(undefined);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);

  const { data: status, mutate } = useSWR(isOIDCEnabled ? "OIDC_LINK_STATUS" : null, () =>
    authService.getOIDCLinkStatus()
  );

  // Result of the link round trip
  useEffect(() => {
    const linked = searchParams.get("oidc_linked");
    const errorCode = searchParams.get("error_code");
    if (!linked && !errorCode) return;
    if (linked) {
      setToast({ type: "success", title: t("web.sso_link.linked_title", { provider: providerName }) });
      setSuggestedEmail(searchParams.get("oidc_email") ?? undefined);
      void mutate();
    } else if (errorCode) {
      const error = authErrorHandler(errorCode as EAuthenticationErrorCodes);
      setToast({
        type: "error",
        title: error?.title ?? t("web.sso_link.failed"),
        message: String(error?.message ?? ""),
      });
    }
    // Drop the one-off params so a refresh does not repeat the toast
    router.replace(window.location.pathname);
  }, [searchParams, providerName, mutate, router, t]);

  if (!isOIDCEnabled) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-subtle pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-14 font-medium text-primary">{t("web.sso_link.title")}</h4>
          <p className="text-13 text-tertiary">
            {status?.linked
              ? t("web.sso_link.linked_description", { provider: providerName })
              : t("web.sso_link.unlinked_description", { provider: providerName })}
          </p>
        </div>
        {status && (
          <Button
            variant={status.linked ? "secondary" : "primary"}
            size="md"
            stretch="auto"
            onClick={() => window.location.assign(`${API_BASE_URL}/auth/oidc/link/`)}
            label={status.linked ? t("web.sso_link.relink") : t("web.sso_link.link", { provider: providerName })}
          />
        )}
      </div>
      {suggestedEmail && suggestedEmail !== currentEmail && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-subtle bg-layer-1 p-3">
          <p className="text-13 text-secondary">
            {t("web.sso_link.email_differs", { provider: providerName, email: suggestedEmail })}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="ghost"
              size="sm"
              stretch="auto"
              onClick={() => setSuggestedEmail(undefined)}
              label={t("web.sso_link.keep_email")}
            />
            <Button
              variant="primary"
              size="sm"
              stretch="auto"
              onClick={() => setIsChangeEmailOpen(true)}
              label={t("web.sso_link.use_email")}
            />
          </div>
        </div>
      )}
      <ChangeEmailModal
        isOpen={isChangeEmailOpen}
        onClose={() => setIsChangeEmailOpen(false)}
        defaultEmail={suggestedEmail}
      />
    </div>
  );
});
