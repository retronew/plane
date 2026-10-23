/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { Tab, Tabs, TabsList, TabsPanel } from "@makeplane/propel/components/tabs";
import { useTranslation } from "@plane/i18n";
import { ApiTokenSkillSetup } from "@/components/api-token/skill-setup";
import { ApiTokenPluginSetup } from "@/components/api-token/plugin-setup";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { useCommandPalette } from "@/hooks/store/use-command-palette";

export const SkillsProfileSettings = observer(function SkillsProfileSettings() {
  const { t } = useTranslation();
  const { toggleProfileSettingsModal } = useCommandPalette();

  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("account_settings.skills.title")}
        description={t("account_settings.skills.description")}
      />
      <div className="mt-5">
        <Tabs variant="contained" defaultValue="skills">
          <TabsList>
            <Tab value="skills" label={t("account_settings.skills.mode_skills")} />
            <Tab value="plugins" label={t("account_settings.plugins.title")} />
          </TabsList>
          <TabsPanel value="skills">
            <ApiTokenSkillSetup />
          </TabsPanel>
          <TabsPanel value="plugins">
            <ApiTokenPluginSetup />
          </TabsPanel>
        </Tabs>
      </div>
      <div className="mt-4">
        <Button
          variant="secondary"
          size="sm"
          stretch="auto"
          label={t("account_settings.skills.configure_mcp")}
          onClick={() => toggleProfileSettingsModal({ activeTab: "mcp", isOpen: true })}
        />
      </div>
    </div>
  );
});
