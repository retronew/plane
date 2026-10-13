/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// icons
import { SettingsOutline } from "@makeplane/propel/icons";
// plane internal packages
import { Button } from "@makeplane/propel/components/button";
import { Switch } from "@makeplane/propel/components/switch";
import type { TInstanceAuthenticationMethodKeys } from "@plane/types";
// components
import { InstanceGiteaConfigForm } from "@/components/authentication/forms/gitea-form";
import { ProviderConfigModal } from "@/components/authentication/provider-config-modal";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

type Props = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
};

export const GiteaConfiguration = observer(function GiteaConfiguration(props: Props) {
  const { disabled, updateConfig } = props;
  const { t } = useTranslation();
  // states
  const [isModalOpen, setIsModalOpen] = useState(false);
  // store
  const { formattedConfig } = useInstance();
  // derived values
  const GiteaConfig = formattedConfig?.IS_GITEA_ENABLED ?? "";
  const GiteaConfigured =
    !!formattedConfig?.GITEA_HOST && !!formattedConfig?.GITEA_CLIENT_ID && !!formattedConfig?.GITEA_CLIENT_SECRET;

  return (
    <>
      <ProviderConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        renderForm={(formProps) => <InstanceGiteaConfigForm {...formProps} />}
      />
      {GiteaConfigured ? (
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            size="sm"
            stretch="auto"
            onClick={() => setIsModalOpen(true)}
            label={t("admin.authentication.edit")}
          />
          <Switch
            checked={Boolean(parseInt(GiteaConfig))}
            onCheckedChange={() => {
              updateConfig("IS_GITEA_ENABLED", parseInt(GiteaConfig) ? "0" : "1");
            }}
            size="sm"
            aria-label={t("admin.authentication.enable_provider", { provider: "Gitea" })}
            disabled={disabled}
          />
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          onClick={() => setIsModalOpen(true)}
          icon={<SettingsOutline className="h-4 w-4 p-0.5 text-tertiary" />}
          label={t("admin.authentication.configure")}
        />
      )}
    </>
  );
});
