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
import { InstanceGoogleConfigForm } from "@/components/authentication/forms/google-form";
import { ProviderConfigModal } from "@/components/authentication/provider-config-modal";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

type Props = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
};

export const GoogleConfiguration = observer(function GoogleConfiguration(props: Props) {
  const { disabled, updateConfig } = props;
  const { t } = useTranslation();
  // states
  const [isModalOpen, setIsModalOpen] = useState(false);
  // store
  const { formattedConfig } = useInstance();
  // derived values
  const enableGoogleConfig = formattedConfig?.IS_GOOGLE_ENABLED ?? "";
  const isGoogleConfigured = !!formattedConfig?.GOOGLE_CLIENT_ID && !!formattedConfig?.GOOGLE_CLIENT_SECRET;

  return (
    <>
      <ProviderConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        renderForm={(formProps) => <InstanceGoogleConfigForm {...formProps} />}
      />
      {isGoogleConfigured ? (
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            size="sm"
            stretch="auto"
            onClick={() => setIsModalOpen(true)}
            label={t("admin.authentication.edit")}
          />
          <Switch
            checked={Boolean(parseInt(enableGoogleConfig))}
            onCheckedChange={() => {
              const newEnableGoogleConfig = Boolean(parseInt(enableGoogleConfig)) === true ? "0" : "1";
              updateConfig("IS_GOOGLE_ENABLED", newEnableGoogleConfig);
            }}
            size="sm"
            aria-label={t("admin.authentication.enable_provider", { provider: "Google" })}
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
