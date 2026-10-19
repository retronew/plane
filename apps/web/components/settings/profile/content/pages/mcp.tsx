/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { ApiTokenMcpSetup } from "@/components/api-token/mcp-setup";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useAppRouter } from "@/hooks/use-app-router";

export const McpProfileSettings = observer(function McpProfileSettings() {
  const { t } = useTranslation();
  const router = useAppRouter();
  const { profileSettingsModal, toggleProfileSettingsModal } = useCommandPalette();

  const manageTokens = () => {
    if (profileSettingsModal.isOpen) {
      toggleProfileSettingsModal({ activeTab: "api-tokens" });
    } else {
      router.push("/settings/profile/api-tokens");
    }
  };

  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("account_settings.mcp.title")}
        description={t("account_settings.mcp.description")}
      />
      <ApiTokenMcpSetup />
      <div className="mt-4">
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={t("account_settings.mcp.manage_tokens")}
          onClick={manageTokens}
        />
      </div>
    </div>
  );
});
