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
import { InstanceGithubConfigForm } from "@/components/authentication/forms/github-form";
import { ProviderConfigModal } from "@/components/authentication/provider-config-modal";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

type Props = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
};

export const GithubConfiguration = observer(function GithubConfiguration(props: Props) {
  const { disabled, updateConfig } = props;
  const { t } = useTranslation();
  // states
  const [isModalOpen, setIsModalOpen] = useState(false);
  // store
  const { formattedConfig } = useInstance();
  // derived values
  const enableGithubConfig = formattedConfig?.IS_GITHUB_ENABLED ?? "";
  const isGithubConfigured = !!formattedConfig?.GITHUB_CLIENT_ID && !!formattedConfig?.GITHUB_CLIENT_SECRET;

  return (
    <>
      <ProviderConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        renderForm={(formProps) => <InstanceGithubConfigForm {...formProps} />}
      />
      {isGithubConfigured ? (
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            size="sm"
            stretch="auto"
            onClick={() => setIsModalOpen(true)}
            label={t("admin.authentication.edit")}
          />
          <Switch
            checked={Boolean(parseInt(enableGithubConfig))}
            onCheckedChange={() => {
              const newEnableGithubConfig = Boolean(parseInt(enableGithubConfig)) === true ? "0" : "1";
              updateConfig("IS_GITHUB_ENABLED", newEnableGithubConfig);
            }}
            size="sm"
            aria-label={t("admin.authentication.enable_provider", { provider: "GitHub" })}
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
