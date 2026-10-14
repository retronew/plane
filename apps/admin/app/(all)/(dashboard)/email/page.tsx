/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Switch } from "@makeplane/propel/components/switch";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useInstance } from "@/hooks/store";
// types
import type { Route } from "./+types/page";
// local
import { InstanceEmailForm } from "./email-config-form";
import { translate, useTranslation } from "@plane/i18n";

const InstanceEmailPage = observer(function InstanceEmailPage(_props: Route.ComponentProps) {
  // store
  const { fetchInstanceConfigurations, formattedConfig, disableEmail } = useInstance();
  const { t } = useTranslation();

  const { isLoading } = useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSMTPEnabled, setIsSMTPEnabled] = useState(false);

  // Whether SMTP is switched on in the saved configuration, not just in this form
  const isSMTPSaved = formattedConfig?.ENABLE_SMTP === "1";

  const handleToggle = async () => {
    // Switching off an unsaved form only hides it; there is nothing to disable on the server
    if (isSMTPEnabled && !isSMTPSaved) {
      setIsSMTPEnabled(false);
      return;
    }
    if (isSMTPEnabled) {
      setIsSubmitting(true);
      try {
        await disableEmail();
        setIsSMTPEnabled(false);
        setToast({
          title: t("admin.email.toast_disabled.title"),
          message: t("admin.email.toast_disabled.message"),
          type: "success",
        });
      } catch (_error) {
        setToast({
          title: t("admin.email.toast_disable_error.title"),
          message: t("admin.email.toast_disable_error.message"),
          type: "error",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    setIsSMTPEnabled(true);
  };
  useEffect(() => {
    if (formattedConfig) {
      setIsSMTPEnabled(formattedConfig.ENABLE_SMTP === "1");
    }
  }, [formattedConfig]);

  return (
    <PageWrapper
      header={{
        title: t("admin.email.title"),
        description: (
          <>
            {t("admin.email.description")}
            <div className="text-13 font-regular text-tertiary">
              {t("admin.email.test_before_save")}&nbsp;
              <span className="text-danger-primary">{t("admin.email.misconfig_warning")}</span>
            </div>
          </>
        ),
        actions: isLoading ? (
          <Skeleton>
            <Skeleton.Item width="24px" height="16px" className="rounded-full" />
          </Skeleton>
        ) : (
          <Switch
            aria-label={t("admin.email.enable_smtp")}
            checked={isSMTPEnabled}
            onCheckedChange={handleToggle}
            size="sm"
            disabled={isSubmitting}
          />
        ),
      }}
    >
      {isSMTPEnabled && !isLoading && (
        <>
          {formattedConfig ? (
            <InstanceEmailForm config={formattedConfig} />
          ) : (
            <Skeleton className="space-y-10">
              <Skeleton.Item height="50px" width="75%" />
              <Skeleton.Item height="50px" width="75%" />
              <Skeleton.Item height="50px" width="40%" />
              <Skeleton.Item height="50px" width="40%" />
              <Skeleton.Item height="50px" width="20%" />
            </Skeleton>
          )}
        </>
      )}
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: translate("admin.meta.email") }];

export default InstanceEmailPage;
