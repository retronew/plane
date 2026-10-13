/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane internal packages
import { Switch } from "@makeplane/propel/components/switch";
// icons
import { LockOutline } from "@makeplane/propel/icons";
// components
import { AuthenticationMethodCard } from "@/components/authentication/authentication-method-card";
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import { setPromiseToast } from "@plane/blocks/toast";
// hooks
import { useInstance } from "@/hooks/store";
import { translate, useTranslation } from "@plane/i18n";
// types
import type { Route } from "./+types/page";
// local
import { InstanceOIDCConfigForm } from "./form";

const InstanceOIDCAuthenticationPage = observer(function InstanceOIDCAuthenticationPage() {
  const { t } = useTranslation();
  // store
  const { fetchInstanceConfigurations, formattedConfig, updateInstanceConfigurations } = useInstance();
  // state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // config
  const enableOIDCConfig = formattedConfig?.IS_OIDC_ENABLED ?? "";
  useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const updateConfig = async (key: "IS_OIDC_ENABLED", value: string) => {
    setIsSubmitting(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: t("admin.authentication.saving_configuration"),
      success: {
        title: t("admin.authentication.provider.configuration_saved"),
        message: () =>
          value === "1"
            ? t("admin.authentication.provider.now_active", { provider: "OIDC" })
            : t("admin.authentication.provider.now_disabled", { provider: "OIDC" }),
      },
      error: {
        title: t("admin.common.error"),
        message: () => t("admin.authentication.configuration_save_failed"),
      },
    });

    await updateConfigPromise
      .then(() => {
        setIsSubmitting(false);
        return undefined;
      })
      .catch((err) => {
        console.error(err);
        setIsSubmitting(false);
      });
  };

  const isOIDCEnabled = enableOIDCConfig === "1";

  return (
    <PageWrapper
      customHeader={
        <AuthenticationMethodCard
          name="OIDC"
          description={t("admin.authentication.modes.oidc.description")}
          icon={<LockOutline className="h-6 w-6 p-0.5 text-tertiary" />}
          config={
            <Switch
              aria-label={t("admin.authentication.enable_provider", { provider: "OIDC" })}
              checked={isOIDCEnabled}
              onCheckedChange={() => {
                updateConfig("IS_OIDC_ENABLED", isOIDCEnabled ? "0" : "1");
              }}
              size="sm"
              disabled={isSubmitting || !formattedConfig}
            />
          }
          disabled={isSubmitting || !formattedConfig}
          withBorder={false}
        />
      }
    >
      {formattedConfig ? (
        <InstanceOIDCConfigForm config={formattedConfig} />
      ) : (
        <Skeleton className="space-y-8">
          <Skeleton.Item height="50px" width="25%" />
          <Skeleton.Item height="50px" />
          <Skeleton.Item height="50px" />
          <Skeleton.Item height="50px" />
          <Skeleton.Item height="50px" width="50%" />
        </Skeleton>
      )}
    </PageWrapper>
  );
});
export const meta: Route.MetaFunction = () => [
  { title: translate("admin.meta.provider_authentication", { provider: "OIDC" }) },
];

export default InstanceOIDCAuthenticationPage;
