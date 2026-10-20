/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme as useNextTheme } from "next-themes";
import { Icon } from "@makeplane/propel/components/icon";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
  MenuTrigger,
} from "@makeplane/propel/components/menu";
import { Avatar } from "@makeplane/propel/components/avatar";
import { AccessAndRolesOutline, LogOutOutline, PaletteOutline } from "@makeplane/propel/icons";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { AuthService } from "@plane/services";
import { getFileURL, cn } from "@plane/utils";
// hooks
import { useTheme, useUser } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";

// service initialization
const authService = new AuthService();

export const AdminSidebarDropdown = observer(function AdminSidebarDropdown() {
  // store hooks
  const { isSidebarCollapsed } = useTheme();
  const { t } = useTranslation();
  const { currentUser, signOut } = useUser();
  // hooks
  const { theme, setTheme } = useNextTheme();
  // state
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  // refs
  // A Base UI menu closes (and unmounts its rows) on item press, so a submit button inside the
  // panel would be detached before the browser ran the default action. The sign-out form lives
  // outside the menu and the row submits it explicitly.
  const signOutFormRef = useRef<HTMLFormElement>(null);

  const handleSignOut = () => signOut();

  const getSidebarMenuItems = () => (
    <MenuContent side="bottom" align="start">
      <MenuGroup>
        <MenuLabel>{currentUser?.email}</MenuLabel>
      </MenuGroup>
      <MenuSeparator />
      <MenuSubmenu>
        <MenuSubmenuTrigger icon={<Icon icon={PaletteOutline} />} label={t("admin.sidebar.appearance")} />
        <MenuSubmenuContent>
          <MenuRadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(String(value))}>
            <MenuRadioItem value="light" icon={<Icon icon={Sun} />} label={t("admin.sidebar.light")} />
            <MenuRadioItem value="dark" icon={<Icon icon={Moon} />} label={t("admin.sidebar.dark")} />
            <MenuRadioItem value="system" icon={<Icon icon={Monitor} />} label={t("admin.sidebar.follow_system")} />
          </MenuRadioGroup>
        </MenuSubmenuContent>
      </MenuSubmenu>
      <MenuSeparator />
      <MenuItem
        icon={<Icon icon={LogOutOutline} />}
        label={t("admin.sidebar.sign_out")}
        onClick={() => signOutFormRef.current?.requestSubmit()}
      />
    </MenuContent>
  );

  useEffect(() => {
    if (csrfToken === undefined)
      void authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
  }, [csrfToken]);

  return (
    <div className="flex max-h-header items-center gap-x-5 gap-y-2 border-b border-subtle px-4 py-2.5">
      <form
        ref={signOutFormRef}
        className="hidden"
        method="POST"
        action={`${API_BASE_URL}/api/instances/admins/sign-out/`}
        onSubmit={handleSignOut}
      >
        <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
      </form>
      <div className="h-full w-full truncate">
        <div
          className={`flex flex-grow items-center gap-x-2 truncate rounded-sm ${
            isSidebarCollapsed ? "justify-center" : ""
          }`}
        >
          <Menu>
            <MenuTrigger
              render={
                <button
                  type="button"
                  aria-label={t("admin.sidebar.instance_admin_menu")}
                  className={cn("grid flex-shrink-0 place-items-center outline-none", {
                    "cursor-default": !isSidebarCollapsed,
                  })}
                >
                  <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-sm bg-layer-1">
                    <AccessAndRolesOutline className="size-5 text-primary" />
                  </div>
                </button>
              }
            />
            {isSidebarCollapsed && getSidebarMenuItems()}
          </Menu>

          {!isSidebarCollapsed && (
            <div className="flex w-full gap-2">
              <h4 className="grow truncate text-body-md-medium text-primary">{t("admin.sidebar.instance_admin")}</h4>
            </div>
          )}
        </div>
      </div>

      {!isSidebarCollapsed && currentUser && (
        <Menu>
          <MenuTrigger
            render={
              <button
                type="button"
                aria-label={t("admin.sidebar.account_menu")}
                className="grid flex-shrink-0 place-items-center outline-none"
              >
                <Avatar
                  alt={currentUser.display_name ?? t("admin.sidebar.admin_user")}
                  fallback={currentUser.display_name?.[0]?.toUpperCase()}
                  src={getFileURL(currentUser.avatar_url)}
                  size="sm"
                />
              </button>
            }
          />
          {getSidebarMenuItems()}
        </Menu>
      )}
    </div>
  );
});
