import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { ROLE_DETAILS, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation, translate } from "@plane/i18n";
import { CircleMinus } from "lucide-react";
import { DeactivatedUserOutline, MoreHorizontalOutline } from "@makeplane/propel/icons";
import { Badge } from "@makeplane/propel/components/badge";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { setToast } from "@plane/blocks/toast";
import type { IUser, IWorkspaceMember } from "@plane/types";
// plane ui
import { Select } from "@plane/blocks/select";
// helpers
import { getFileURL } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useUser, useUserPermissions } from "@/hooks/store/user";

export interface RowData {
  member: IWorkspaceMember;
  role: EUserPermissions;
  is_active: boolean;
}

type NameProps = {
  rowData: RowData;
  workspaceSlug: string;
  isAdmin: boolean;
  currentUser: IUser | undefined;
  setRemoveMemberModal: (rowData: RowData) => void;
};

type TRoleOption = { key: EUserPermissions; labelKey: string };

const ROLE_OPTIONS: TRoleOption[] = Object.entries(ROLE_DETAILS).map(([key, details]) => ({
  key: Number(key) as EUserPermissions,
  labelKey: details.i18n_title,
}));

type AccountTypeProps = {
  rowData: RowData;
  workspaceSlug: string;
};

export function NameColumn(props: NameProps) {
  const { rowData, workspaceSlug, isAdmin, currentUser, setRemoveMemberModal } = props;
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const { avatar_url, display_name, email, first_name, id, last_name } = rowData.member;
  const isSuspended = rowData.is_active === false;
  const memberName = [first_name, last_name].filter(Boolean).join(" ") || display_name || email;

  return (
    <div className="group relative">
      <div className="flex w-44 items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-x-2 gap-y-2">
          {isSuspended ? (
            <div className="rounded-full bg-layer-1">
              <DeactivatedUserOutline className="size-6 text-placeholder" />
            </div>
          ) : avatar_url && avatar_url.trim() !== "" ? (
            <Link className="shrink-0" href={`/${workspaceSlug}/profile/${id}`}>
              <span className="relative flex size-6 items-center justify-center rounded-full text-on-color capitalize">
                <img
                  src={getFileURL(avatar_url)}
                  className="absolute top-0 left-0 h-full w-full rounded-full object-cover"
                  alt={display_name || email}
                />
              </span>
            </Link>
          ) : (
            <Link className="shrink-0" href={`/${workspaceSlug}/profile/${id}`}>
              <span className="relative flex size-6 items-center justify-center rounded-full bg-layer-3 text-11 text-tertiary capitalize">
                {(email ?? display_name ?? "?")[0]}
              </span>
            </Link>
          )}
          {isSuspended ? (
            <span title={memberName} className="truncate text-placeholder">
              {memberName}
            </span>
          ) : (
            <Link href={`/${workspaceSlug}/profile/${id}`} title={memberName} className="truncate hover:underline">
              {memberName}
            </Link>
          )}
        </div>

        {!isSuspended && (isAdmin || id === currentUser?.id) && (
          <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[data-popup-open]]:opacity-100">
            <Menu>
              <MenuTrigger
                render={
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={t("aria_labels.common.more_actions")}
                    icon={<Icon icon={MoreHorizontalOutline} />}
                  />
                }
              />
              {/* Single action: size to the content instead of the 204px default */}
              <MenuContent side="bottom" align="end" sizing="anchor">
                <MenuItem
                  variant="danger"
                  icon={<Icon icon={CircleMinus} />}
                  label={id === currentUser?.id ? t("web.member_management.leave_workspace") : t("remove")}
                  onClick={() => setRemoveMemberModal(rowData)}
                />
              </MenuContent>
            </Menu>
          </div>
        )}
      </div>
    </div>
  );
}

export const AccountTypeColumn = observer(function AccountTypeColumn(props: AccountTypeProps) {
  const { rowData, workspaceSlug } = props;
  // form info
  const { control } = useForm();
  const { t } = useTranslation();
  // store hooks
  const { allowPermissions } = useUserPermissions();

  const {
    workspace: { updateMember },
  } = useMember();
  const { data: currentUser } = useUser();

  // derived values
  const isCurrentUser = currentUser?.id === rowData.member.id;
  const isAdminRole = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const isRoleNonEditable = isCurrentUser || !isAdminRole;
  const roleDisabledReason = isCurrentUser
    ? t("web.member_management.own_workspace_role_readonly")
    : !isAdminRole
      ? t("web.member_management.workspace_role_admin_required")
      : undefined;
  const isSuspended = rowData.is_active === false;
  const roleOption = ROLE_OPTIONS.find((role) => role.key === rowData.role);
  const roleLabel = roleOption ? t(roleOption.labelKey) : "—";

  return (
    <>
      {isSuspended ? (
        <div className="flex w-32">
          <Badge variant="neutral" size="sm" label={translate("web.suspended")} />
        </div>
      ) : (
        <Controller
          name="role"
          control={control}
          rules={{ required: translate("web.role_is_required") }}
          render={() => (
            <Tooltip label={roleDisabledReason}>
              <div
                className="w-32"
                role={isRoleNonEditable ? "group" : undefined}
                aria-label={isRoleNonEditable ? `${t("role")}, ${roleLabel}` : undefined}
                tabIndex={isRoleNonEditable ? 0 : undefined}
              >
                <Select<TRoleOption>
                  disabled={isRoleNonEditable}
                  placeholder={t("role")}
                  value={roleOption ?? null}
                  onChange={(val) => {
                    if (!workspaceSlug || isRoleNonEditable || !val) return;
                    updateMember(workspaceSlug.toString(), rowData.member.id, {
                      role: Number(val) as EUserPermissions,
                    }).catch((err: unknown) => {
                      const error = err as { error?: string | string[] };
                      const errorString = Array.isArray(error?.error) ? error.error[0] : error?.error;

                      setToast({
                        type: "error",
                        title: translate("toast.error"),
                        message:
                          errorString ?? translate("web.an_error_occurred_while_updating_member_role_please_try_agai"),
                      });
                    });
                  }}
                  getValues={() => ROLE_OPTIONS}
                  getOptionValue={(role) => String(role.key)}
                  getOptionLabel={(role) => t(role.labelKey)}
                  showSearch={false}
                  pinSelected={false}
                >
                  <Select.Trigger<TRoleOption>
                    variant="select-ghost-md"
                    className={isRoleNonEditable ? "[&_svg]:visible" : undefined}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{roleLabel}</span>
                  </Select.Trigger>
                </Select>
              </div>
            </Tooltip>
          )}
        />
      )}
    </>
  );
});
