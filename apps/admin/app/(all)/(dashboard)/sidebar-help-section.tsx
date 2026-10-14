/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { WEB_BASE_URL } from "@plane/constants";
// plane internal packages
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import {
  ChatOutline,
  Github,
  HelpOutline,
  LeftSidePaneOutline,
  NewTabOutline,
  PagesOutline,
} from "@makeplane/propel/icons";
import { cn } from "@plane/utils";
// hooks
import { useInstance, useTheme } from "@/hooks/store";
import { useTranslation } from "@plane/i18n";
// assets

const helpOptions = [
  {
    name: "admin.help.documentation",
    href: "https://docs.plane.so/",
    Icon: PagesOutline,
  },
  {
    name: "admin.help.forum",
    href: "https://forum.plane.so",
    Icon: ChatOutline,
  },
  {
    name: "admin.help.report_bug",
    href: "https://github.com/makeplane/plane/issues/new/choose",
    Icon: Github,
  },
];

export const AdminSidebarHelpSection = observer(function AdminSidebarHelpSection() {
  const { t } = useTranslation();
  // store
  const { instance } = useInstance();
  const { isSidebarCollapsed, toggleSidebar } = useTheme();

  const redirectionLink = encodeURI(WEB_BASE_URL + "/");

  return (
    <div
      className={cn(
        "flex h-14 w-full flex-shrink-0 items-center justify-between gap-1 self-baseline border-t border-subtle bg-surface-1 px-4",
        {
          "h-auto flex-col py-1.5": isSidebarCollapsed,
        }
      )}
    >
      <div className={`flex items-center gap-1 ${isSidebarCollapsed ? "flex-col justify-center" : "w-full"}`}>
        {!isSidebarCollapsed ? (
          <>
            <a
              href={redirectionLink}
              target="_blank"
              rel="noreferrer"
              className={`relative flex items-center gap-1 rounded-sm bg-layer-1 px-2 py-1 text-body-xs-medium whitespace-nowrap text-secondary`}
            >
              <NewTabOutline width={14} height={14} />
              {!isSidebarCollapsed && t("admin.help.redirect_to_plane")}
            </a>
          </>
        ) : (
          <Tooltip label={t("admin.help.redirect_to_plane")} side="right">
            <a
              href={redirectionLink}
              target="_blank"
              rel="noreferrer"
              className={`relative flex items-center gap-1 rounded-sm bg-layer-1 px-2 py-1 text-body-xs-medium whitespace-nowrap text-secondary`}
            >
              <NewTabOutline width={14} height={14} />
              {!isSidebarCollapsed && t("admin.help.redirect_to_plane")}
            </a>
          </Tooltip>
        )}
        {/* Same composition as the web app's help menu and sidebar toggle (propel Menu + IconButton) */}
        <div className={isSidebarCollapsed ? "" : "ml-auto"}>
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  size="sm"
                  variant="ghost"
                  icon={<Icon icon={HelpOutline} />}
                  aria-label={t("admin.help.help")}
                  showTooltip
                />
              }
            />
            <MenuContent
              side={isSidebarCollapsed ? "right" : "top"}
              align="end"
              footer={
                <div className="shrink-0 border-t border-subtle bg-layer-2 px-3 py-2 text-caption-md-regular text-tertiary">
                  {t("admin.help.version", { version: instance?.current_version })}
                </div>
              }
            >
              {helpOptions.map(({ name, Icon: OptionIcon, href }) => (
                <MenuItem
                  key={name}
                  icon={<Icon icon={OptionIcon} tint="secondary" />}
                  label={t(name)}
                  onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
                />
              ))}
            </MenuContent>
          </Menu>
        </div>
        <IconButton
          size="sm"
          variant="ghost"
          icon={<Icon icon={LeftSidePaneOutline} />}
          aria-label={t("admin.header.toggle_sidebar")}
          showTooltip
          onClick={() => toggleSidebar(!isSidebarCollapsed)}
        />
      </div>
    </div>
  );
});
