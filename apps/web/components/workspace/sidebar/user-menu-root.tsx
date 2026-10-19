/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { Plug, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  KeyOutline,
  LockOutline,
  LogOutOutline,
  SettingsOutline,
  SubscribeOutline,
  UserOutline,
} from "@makeplane/propel/icons";
// plane imports
import { Avatar } from "@makeplane/propel/components/avatar";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import { GOD_MODE_URL, PROFILE_SETTINGS, PROFILE_SETTINGS_TABS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TProfileSettingsTabs } from "@plane/types";
import { getFileURL } from "@plane/utils";
// components
import { CoverImage } from "@/components/common/cover-image";
import { AppSidebarItem } from "@/components/sidebar/sidebar-item";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useUser } from "@/hooks/store/user";
import { usePasswordManagement } from "@/hooks/use-password-management";

// Mirrors the icons used by the profile settings sidebar.
const PROFILE_SETTINGS_ICONS: Record<TProfileSettingsTabs, typeof SettingsOutline | LucideIcon> = {
  general: UserOutline,
  preferences: SettingsOutline,
  notifications: SubscribeOutline,
  security: LockOutline,
  "api-tokens": KeyOutline,
  mcp: Plug,
};

// Same order as the settings sidebar.
const MENU_TABS: TProfileSettingsTabs[] = ["general", "preferences", "notifications", "security", "api-tokens", "mcp"];

export const UserMenuRoot = observer(function UserMenuRoot() {
  // states
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  // router
  const router = useRouter();
  // store hooks
  const { toggleAnySidebarDropdown } = useAppTheme();
  const { data: currentUser } = useUser();
  const { signOut } = useUser();
  const { toggleProfileSettingsModal } = useCommandPalette();
  const { canManagePassword } = usePasswordManagement();
  // derived values
  const isUserInstanceAdmin = false;
  // translation
  const { t } = useTranslation();

  const handleSignOut = () => {
    signOut().catch(() =>
      setToast({
        type: "error",
        title: t("auth.sign_out.toast.error.title"),
        message: t("auth.sign_out.toast.error.message"),
      })
    );
  };

  // Toggle sidebar dropdown state when menu is open
  useEffect(() => {
    if (isUserMenuOpen) toggleAnySidebarDropdown(true);
    else toggleAnySidebarDropdown(false);
  }, [isUserMenuOpen, toggleAnySidebarDropdown]);

  return (
    <div className="flex items-center">
      <Menu onOpenChange={setIsUserMenuOpen}>
        {/* propel: `AppSidebarItem` takes no arbitrary props, so it cannot be the Base UI trigger
            — the popup would have no element to anchor to. The trigger is a plain button wearing
            the same chrome, with the item's own icon part inside it. */}
        <MenuTrigger
          render={
            <button
              type="button"
              className="group flex flex-col items-center justify-center gap-0.5 text-tertiary"
              aria-label={t("aria_labels.projects_sidebar.open_user_menu")}
            >
              <AppSidebarItem.Icon
                icon={
                  <Avatar
                    alt={currentUser?.display_name}
                    fallback={currentUser?.display_name?.[0]?.toUpperCase()}
                    src={getFileURL(currentUser?.avatar_url ?? "")}
                    size="xs"
                  />
                }
                highlight={isUserMenuOpen}
                className="size-7"
              />
            </button>
          }
        />
        <MenuContent side="bottom" align="end">
          <div className="flex w-70 max-w-full flex-col">
            <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-md px-2 py-4">
              <CoverImage
                src={currentUser?.cover_image_url ?? undefined}
                alt=""
                className="absolute inset-0 size-full"
              />
              <div className="absolute inset-0 bg-black/50" />
              <div className="relative flex">
                <Avatar
                  alt={currentUser?.display_name}
                  fallback={currentUser?.display_name?.[0]?.toUpperCase()}
                  src={getFileURL(currentUser?.avatar_url ?? "")}
                  size="xl"
                />
              </div>
              <div className="relative w-full min-w-0 text-center text-on-color">
                <p className="truncate text-body-sm-medium">
                  {currentUser?.first_name} {currentUser?.last_name}
                </p>
                <p className="truncate text-caption-md-regular" title={currentUser?.email}>
                  {currentUser?.email}
                </p>
              </div>
            </div>
            <div className="mt-1">
              {MENU_TABS.filter(
                (tab) => PROFILE_SETTINGS_TABS.includes(tab) && (tab !== "security" || canManagePassword)
              ).map((tab) => (
                <MenuItem
                  key={tab}
                  icon={<Icon icon={PROFILE_SETTINGS_ICONS[tab]} />}
                  label={t(PROFILE_SETTINGS[tab].i18n_label)}
                  onClick={() => toggleProfileSettingsModal({ activeTab: tab, isOpen: true })}
                />
              ))}
            </div>
            <MenuSeparator />
            <div>
              <MenuItem
                variant="danger"
                icon={<Icon icon={LogOutOutline} />}
                label={t("sign_out")}
                onClick={handleSignOut}
              />
              {isUserInstanceAdmin && (
                <MenuItem variant="accent" label={t("enter_god_mode")} onClick={() => router.push(GOD_MODE_URL)} />
              )}
            </div>
          </div>
        </MenuContent>
      </Menu>
    </div>
  );
});
