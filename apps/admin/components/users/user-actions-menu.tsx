/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import useSWR, { useSWRConfig } from "swr";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@makeplane/propel/components/menu";
import { MoreHorizontalOutline } from "@makeplane/propel/icons";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { InstanceService } from "@plane/services";
import type { IInstanceAdmin, IInstanceUser } from "@plane/types";
import { useInstance, useUser } from "@/hooks/store";
import { allowedAccountActions, isInstanceUserCacheKey } from "./profile";
import type { AccountAction } from "./profile";

const service = new InstanceService();
const ERROR_KEYS: Record<string, string> = {
  CANNOT_DEACTIVATE_SELF: "admin.users.errors.cannot_deactivate_self",
  USER_IS_ADMIN: "admin.users.admin_hint",
  ALREADY_ADMIN: "admin.admins.errors.already_admin",
  USER_NOT_FOUND: "admin.admins.errors.user_not_found",
  CANNOT_REMOVE_SELF: "admin.admins.errors.cannot_remove_self",
  LAST_ADMIN: "admin.admins.errors.last_admin",
};

export function UserActionsMenu({
  user,
  currentUserId,
  admins,
  onEdit,
  onAction,
}: {
  user: IInstanceUser;
  currentUserId: string | undefined;
  admins: IInstanceAdmin[] | undefined;
  onEdit: () => void;
  onAction: (action: AccountAction) => void;
}) {
  const { t } = useTranslation();
  const actions = allowedAccountActions(user, currentUserId, admins);
  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t("admin.users.details.menu_label", { email: user.email })}
            icon={<Icon icon={MoreHorizontalOutline} />}
          />
        }
      />
      <MenuContent side="bottom" align="end">
        <MenuItem label={t("admin.users.details.edit_profile")} onClick={onEdit} />
        {actions.length > 0 && <MenuSeparator />}
        {actions.map((action) => (
          <MenuItem
            key={action}
            variant={action === "deactivate" || action === "revoke" ? "danger" : undefined}
            label={t(`admin.users.details.actions.${action}`)}
            onClick={() => onAction(action)}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}

export const UserActionConfirmation = observer(function UserActionConfirmation({
  user,
  action,
  isOpen,
  onClose,
}: {
  user: IInstanceUser;
  action: AccountAction;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { currentUser, fetchCurrentUser } = useUser();
  const { fetchInstanceAdmins } = useInstance();
  const { mutate } = useSWRConfig();
  const { data: admins } = useSWR("INSTANCE_ADMINS", () => fetchInstanceAdmins());
  const { data: latestUser } = useSWR(["INSTANCE_USER", user.id], () => service.getUser(user.id));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const allowed = allowedAccountActions(latestUser ?? user, currentUser?.id, admins).includes(action);
  const executeAction = async () => {
    if (inFlight.current || !allowed) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      switch (action) {
        case "activate":
          await service.activateUser(user.id);
          break;
        case "deactivate":
          await service.deactivateUser(user.id);
          break;
        case "promote":
          await service.addAdmin(user.email);
          break;
        case "revoke": {
          const admin = admins?.find((entry) => entry.user === user.id);
          if (!admin) throw new Error("Admin not found");
          await service.removeAdmin(admin.id);
          break;
        }
      }
      onClose();
      setToast({
        type: "success",
        title: t("admin.common.success"),
        message: t(`admin.users.details.success.${action}`),
      });
      const results = await Promise.allSettled([
        mutate(isInstanceUserCacheKey),
        mutate("INSTANCE_ADMINS"),
        fetchCurrentUser(),
      ]);
      if (results.some((result) => result.status === "rejected")) {
        setToast({ type: "error", title: t("admin.users.details.refresh_failed") });
      }
    } catch (error) {
      const code = (error as { error_code?: string } | undefined)?.error_code;
      setFailure(t(code && ERROR_KEYS[code] ? ERROR_KEYS[code] : "admin.users.errors.default"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      isOpen={isOpen}
      isSubmitting={busy}
      isDisabled={busy || !allowed}
      handleClose={() => {
        if (!inFlight.current) onClose();
      }}
      handleSubmit={executeAction}
      title={t(`admin.users.details.actions.${action}`)}
      variant={action === "deactivate" || action === "revoke" ? "danger" : "primary"}
      primaryButtonText={{
        default: t("admin.users.details.confirm_action"),
        loading: t("admin.users.details.processing"),
      }}
      secondaryButtonText={t("admin.common.cancel")}
      content={
        <>
          <span className="break-words">{t(`admin.users.details.confirm.${action}`, { email: user.email })}</span>
          {failure && (
            <span role="alert" className="mt-3 block text-danger-primary">
              {failure}
            </span>
          )}
        </>
      }
    />
  );
});
