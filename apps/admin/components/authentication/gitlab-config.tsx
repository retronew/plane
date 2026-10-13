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
import { InstanceGitlabConfigForm } from "@/components/authentication/forms/gitlab-form";
import { ProviderConfigModal } from "@/components/authentication/provider-config-modal";
// hooks
import { useInstance } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

type Props = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
};

export const GitlabConfiguration = observer(function GitlabConfiguration(props: Props) {
  const { disabled, updateConfig } = props;
  const { t } = useTranslation();
  // states
  const [isModalOpen, setIsModalOpen] = useState(false);
  // store
  const { formattedConfig } = useInstance();
  // derived values
  const enableGitlabConfig = formattedConfig?.IS_GITLAB_ENABLED ?? "";
  const isGitlabConfigured = !!formattedConfig?.GITLAB_CLIENT_ID && !!formattedConfig?.GITLAB_CLIENT_SECRET;

  return (
    <>
      <ProviderConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        renderForm={(formProps) => <InstanceGitlabConfigForm {...formProps} />}
      />
      {isGitlabConfigured ? (
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            size="sm"
            stretch="auto"
            onClick={() => setIsModalOpen(true)}
            label={t("admin.authentication.edit")}
          />
          <Switch
            checked={Boolean(parseInt(enableGitlabConfig))}
            onCheckedChange={() => {
              const newEnableGitlabConfig = Boolean(parseInt(enableGitlabConfig)) === true ? "0" : "1";
              updateConfig("IS_GITLAB_ENABLED", newEnableGitlabConfig);
            }}
            size="sm"
            aria-label={t("admin.authentication.enable_provider", { provider: "GitLab" })}
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
