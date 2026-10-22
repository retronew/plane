/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { CloseOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
// plane imports
import { Dialog, DialogClose, DialogCloseGroup, DialogContent, DialogTitle } from "@makeplane/propel/components/dialog";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { PROFILE_SETTINGS, PROFILE_SETTINGS_TABS } from "@plane/constants";
import type { TProfileSettingsTabs } from "@plane/types";
import { usePasswordManagement } from "@/hooks/use-password-management";
import { useTranslation } from "@plane/i18n";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
// local imports
import { ProfileSettingsContent } from "./content";
import { ProfileSettingsSidebarRoot } from "./sidebar";

export const ProfileSettingsModal = observer(function ProfileSettingsModal() {
  // plane hooks
  const { t } = useTranslation();
  const { canManagePassword } = usePasswordManagement();
  // store hooks
  const { profileSettingsModal, toggleProfileSettingsModal } = useCommandPalette();
  // derived values
  const activeTab = profileSettingsModal.activeTab ?? "general";

  const handleClose = useCallback(() => {
    toggleProfileSettingsModal({
      isOpen: false,
    });
    setTimeout(() => {
      toggleProfileSettingsModal({
        activeTab: null,
      });
    }, 300);
  }, [toggleProfileSettingsModal]);

  return (
    <Dialog
      open={profileSettingsModal.isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="xl" height="fixed">
        <DialogCloseGroup>
          <IconButton
            size="sm"
            variant="ghost"
            icon={<Icon icon={CloseOutline} />}
            aria-label={t("close")}
            render={<DialogClose />}
          />
        </DialogCloseGroup>
        {/* The settings sidebar is the visible chrome, so the dialog's accessible name is carried
            by a visually hidden title. */}
        <div className="sr-only">
          <DialogTitle>{t("profile_settings")}</DialogTitle>
        </div>
        {/* A plain two-column row rather than `DialogPanes`/`DialogAside`/`DialogMain`: the sidebar and
            content roots carry their own gutters and scroll areas, which the pane slots would pad again. */}
        <div className="@container flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="border-b border-subtle px-4 py-4 pe-14 md:hidden">
            <select
              aria-label={t("profile_settings")}
              value={activeTab}
              className="w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-body-sm-regular text-primary focus-visible:outline-2 focus-visible:outline-offset-2"
              onChange={(event) =>
                toggleProfileSettingsModal({ activeTab: event.target.value as TProfileSettingsTabs })
              }
            >
              {PROFILE_SETTINGS_TABS.filter((tab) => tab !== "security" || canManagePassword).map((tab) => (
                <option key={tab} value={tab}>
                  {t(PROFILE_SETTINGS[tab].i18n_label)}
                </option>
              ))}
            </select>
          </div>
          <ProfileSettingsSidebarRoot
            activeTab={activeTab}
            className="hidden w-[280px] rounded-l-xl md:flex"
            updateActiveTab={(tab) => toggleProfileSettingsModal({ activeTab: tab })}
          />
          <ProfileSettingsContent activeTab={activeTab} className="flex-1 rounded-r-xl" />
        </div>
      </DialogContent>
    </Dialog>
  );
});
