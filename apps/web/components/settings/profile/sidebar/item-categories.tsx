/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
import { Plug, type LucideIcon } from "lucide-react";
import { KeyOutline, LockOutline, PreferencesOutline, SubscribeOutline, UserOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
import { useParams } from "react-router";
// plane imports
import {
  GROUPED_PROFILE_SETTINGS,
  PROFILE_SETTINGS_CATEGORIES,
  PROFILE_SETTINGS_CATEGORY_LABELS,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { ISvgIcons } from "@plane/blocks/icons";
import type { TProfileSettingsTabs } from "@plane/types";
// local imports
import { usePasswordManagement } from "@/hooks/use-password-management";
import { SettingsSidebarItem } from "../../sidebar/item";
import { ProfileSettingsSidebarWorkspaceOptions } from "./workspace-options";

const ICONS: Record<TProfileSettingsTabs, LucideIcon | React.FC<ISvgIcons>> = {
  general: UserOutline,
  security: LockOutline,
  preferences: PreferencesOutline,
  notifications: SubscribeOutline,
  "api-tokens": KeyOutline,
  mcp: Plug,
};

type Props = {
  activeTab: TProfileSettingsTabs;
  updateActiveTab: (tab: TProfileSettingsTabs) => void;
};

export const ProfileSettingsSidebarItemCategories = observer(function ProfileSettingsSidebarItemCategories(
  props: Props
) {
  const { activeTab, updateActiveTab } = props;
  // params
  const { profileTabId } = useParams();
  // translation
  const { t } = useTranslation();
  // the security tab only manages the password
  const { canManagePassword } = usePasswordManagement();

  return (
    <div className="mt-4 flex flex-col gap-y-4">
      {PROFILE_SETTINGS_CATEGORIES.map((category) => {
        const categoryItems = GROUPED_PROFILE_SETTINGS[category].filter(
          (item) => item.key !== "security" || canManagePassword
        );

        if (categoryItems.length === 0) return null;

        return (
          <div key={category} className="shrink-0">
            <div className="p-2 text-caption-md-medium text-tertiary capitalize">
              {t(PROFILE_SETTINGS_CATEGORY_LABELS[category])}
            </div>
            <div className="flex flex-col gap-px">
              {categoryItems.map((item) => (
                // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- the item renders `label` as its text
                <SettingsSidebarItem
                  key={item.key}
                  as="button"
                  className="h-8 py-0 [&_svg]:size-4"
                  onClick={() => updateActiveTab(item.key)}
                  isActive={activeTab === item.key}
                  icon={ICONS[item.key]}
                  label={t(item.i18n_label)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {profileTabId && <ProfileSettingsSidebarWorkspaceOptions />}
    </div>
  );
});
