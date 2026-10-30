/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
// plane imports
import { ROLE, ROLE_DETAILS, EUserPermissions } from "@plane/constants";
import { useTranslation, translate } from "@plane/i18n";
import { Avatar } from "@makeplane/propel/components/avatar";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { getFileURL } from "@plane/utils";
import { memberDisplayName, reconcileSelectedMembers } from "@/components/dropdowns/member/member-selection";
import { Button } from "@makeplane/propel/components/button";
import { ChevronDownOutline, CloseOutline } from "@makeplane/propel/icons";
import { setToast } from "@plane/blocks/toast";
import { Select } from "@plane/blocks/select";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
// components
import { MemberSelect } from "@/components/dropdowns/member/member-select";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useUserPermissions } from "@/hooks/store/user";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  projectId: string;
  workspaceSlug: string;
};

type member = {
  role: EUserPermissions;
  member_id: string;
};

type FormValues = {
  members: member[];
};

type TRoleOption = {
  key: EUserPermissions;
  label: string;
};

const defaultValues: FormValues = {
  members: [],
};

export const SendProjectInvitationModal = observer(function SendProjectInvitationModal(props: Props) {
  const { isOpen, onClose, onSuccess, projectId, workspaceSlug } = props;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const {
    project: { getProjectMemberDetails, bulkAddMembersToProject },
    workspace: { workspaceMemberIds, getWorkspaceMemberDetails },
  } = useMember();
  // form info
  const {
    formState: { errors, isSubmitting },
    watch,

    reset,
    handleSubmit,
    control,
  } = useForm<FormValues>({ defaultValues });
  const { fields, replace, remove } = useFieldArray({
    control,
    name: "members",
  });
  // derived values
  const currentProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);
  const uninvitedPeople =
    workspaceMemberIds?.filter((userId) => {
      if (!getWorkspaceMemberDetails(userId)?.member) return false;
      const projectMemberDetails = getProjectMemberDetails(userId, projectId);
      const isInvited = projectMemberDetails?.member.id && projectMemberDetails?.original_role;
      return !isInvited;
    }) ?? [];

  const onSubmit = async (formData: FormValues) => {
    if (!workspaceSlug || !projectId || isSubmitting) return;

    const payload = { ...formData };

    await bulkAddMembersToProject(workspaceSlug.toString(), projectId.toString(), payload)
      .then(() => {
        if (onSuccess) onSuccess();
        onClose();
        setToast({
          title: t("toast.success"),
          type: "success",
          message: t("web.members_added_successfully"),
        });
        return undefined;
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        reset(defaultValues);
      });
  };

  const handleClose = () => {
    onClose();

    const timeout = setTimeout(() => {
      reset(defaultValues);
      clearTimeout(timeout);
    }, 500);
  };

  const checkCurrentOptionWorkspaceRole = (value: string) => {
    const currentMemberWorkspaceRole = getWorkspaceMemberDetails(value)?.role;
    if (!value || !currentMemberWorkspaceRole) return ROLE;

    const isGuestOROwner = [EUserPermissions.ADMIN, EUserPermissions.GUEST].includes(
      currentMemberWorkspaceRole as EUserPermissions
    );

    return Object.fromEntries(
      Object.entries(ROLE).filter(([key]) => !isGuestOROwner || [currentMemberWorkspaceRole].includes(parseInt(key)))
    );
  };

  const getRoleOptions = (memberId: string): TRoleOption[] =>
    Object.entries(checkCurrentOptionWorkspaceRole(memberId))
      .filter(([key]) => parseInt(key) <= (currentProjectRole ?? EUserPermissions.GUEST))
      .map(([key]) => {
        const role = parseInt(key) as EUserPermissions;
        return { key: role, label: t(ROLE_DETAILS[role].i18n_title) };
      });

  const selectedMembers = watch("members");
  const handleMembersChange = (ids: string[]) => {
    replace(
      reconcileSelectedMembers(ids, selectedMembers, (id) => ({
        member_id: id,
        role: (getWorkspaceMemberDetails(id)?.role ?? EUserPermissions.GUEST) as EUserPermissions,
      }))
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{t("project_settings.members.invite_members.title")}</DialogTitle>
                <DialogDescription>{t("project_settings.members.invite_members.sub_heading")}</DialogDescription>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <MemberSelect
                  multiple
                  showSelectAll
                  value={selectedMembers.map((member) => member.member_id)}
                  onChange={handleMembersChange}
                  variant="select-lg"
                  memberIds={uninvitedPeople}
                  placeholder={t("project_settings.members.invite_members.select_members")}
                  className="w-full"
                  disabled={isSubmitting}
                />
                <div className="flex items-center justify-between gap-3 text-13" aria-live="polite">
                  <span className="text-secondary">
                    {t("project_settings.members.invite_members.selected_count", { count: fields.length })}
                  </span>
                  {fields.length > 0 && (
                    <Button
                      type="button"
                      variant="tertiary"
                      stretch="auto"
                      size="sm"
                      label={t("issue.select.deselect_all")}
                      disabled={isSubmitting}
                      onClick={() => replace([])}
                    />
                  )}
                </div>
                {fields.length > 0 && (
                  <div className="divide-y divide-subtle border-y border-subtle">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-4 py-3 text-13">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Avatar
                            size="sm"
                            src={getFileURL(getWorkspaceMemberDetails(field.member_id)?.member.avatar_url ?? "")}
                            alt={memberDisplayName(
                              getWorkspaceMemberDetails(field.member_id)?.member,
                              t("unknown_user")
                            )}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {memberDisplayName(getWorkspaceMemberDetails(field.member_id)?.member, t("unknown_user"))}
                            </div>
                            {(() => {
                              const user = getWorkspaceMemberDetails(field.member_id)?.member;
                              const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
                              return fullName && fullName !== memberDisplayName(user, t("unknown_user")) ? (
                                <div className="truncate text-12 text-secondary">{fullName}</div>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <Controller
                              name={`members.${index}.role`}
                              control={control}
                              rules={{ required: t("web.select_role_2") }}
                              render={({ field: { value, onChange } }) => {
                                const roleOptions = getRoleOptions(watch(`members.${index}.member_id`));
                                return (
                                  <div className="w-24">
                                    <Select<TRoleOption>
                                      getValues={() => roleOptions}
                                      value={roleOptions.find((role) => role.key === value) ?? null}
                                      onChange={(key) => onChange(parseInt(key))}
                                      getOptionValue={(role) => String(role.key)}
                                      getOptionLabel={(role) => role.label}
                                      placeholder={t("web.select_role")}
                                      showSearch={false}
                                      pinSelected={false}
                                    >
                                      <Select.Trigger<TRoleOption>
                                        variant="pill-md"
                                        className="w-full"
                                        appendIcon={<ChevronDownOutline />}
                                        tooltip={{ emptyContent: t("web.select_role") }}
                                      >
                                        <span className="min-w-0 grow truncate text-left capitalize">
                                          {value ? t(ROLE_DETAILS[value].i18n_title) : t("web.select_role")}
                                        </span>
                                      </Select.Trigger>
                                    </Select>
                                  </div>
                                );
                              }}
                            />
                            {errors.members && errors.members[index]?.role && (
                              <span className="px-1 text-13 text-danger-primary">
                                {errors.members[index]?.role?.message}
                              </span>
                            )}
                          </div>

                          <IconButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={t("project_settings.members.invite_members.remove_member", {
                              name: memberDisplayName(
                                getWorkspaceMemberDetails(field.member_id)?.member,
                                t("unknown_user")
                              ),
                            })}
                            disabled={isSubmitting}
                            icon={<CloseOutline className="h-4 w-4" />}
                            onClick={() => remove(index)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <div className="flex w-full items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  stretch="auto"
                  label={t("cancel")}
                  disabled={isSubmitting}
                  onClick={handleClose}
                />
                <Button
                  variant="primary"
                  size="md"
                  stretch="auto"
                  type="submit"
                  label={
                    isSubmitting
                      ? `${fields && fields.length > 1 ? translate("web.runtime.loading_label", { label: t("add_members") }) : translate("web.runtime.loading_label", { label: t("add_member") })}`
                      : `${fields && fields.length > 1 ? t("add_members") : t("add_member")}`
                  }
                  disabled={fields.length === 0 || isSubmitting}
                  loading={isSubmitting}
                />
              </div>
            </div>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
});
