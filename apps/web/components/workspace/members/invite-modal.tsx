/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { InputField } from "@makeplane/propel/components/input-field";
import { SearchOutline } from "@makeplane/propel/icons";
import { Select } from "@plane/blocks/select";
import { EUserPermissions, ROLE_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IWorkspaceBulkInviteFormData } from "@plane/types";
import { cn, getFileURL } from "@plane/utils";
import { InvitationForm } from "@/components/workspace/invite-modal/form";
import { useUserPermissions } from "@/hooks/store/user";
import { WorkspaceService } from "@/services/workspace.service";
import { filterInviteCandidates, getInviteCandidateName } from "./invite-candidates";

const workspaceService = new WorkspaceService();
type TRoleOption = { key: number; label: string };

export type TSendWorkspaceInvitationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: IWorkspaceBulkInviteFormData) => Promise<void> | undefined;
};

export const SendWorkspaceInvitationModal = observer(function SendWorkspaceInvitationModal(
  props: TSendWorkspaceInvitationModalProps
) {
  const { isOpen, onClose, onSubmit } = props;
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { workspaceInfoBySlug } = useUserPermissions();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, EUserPermissions>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slug = workspaceSlug.toString();
  const {
    data: candidates,
    error,
    isLoading,
    mutate,
  } = useSWR(isOpen ? ["workspace-invite-candidates", slug] : null, () => workspaceService.getInviteCandidates(slug), {
    revalidateOnFocus: false,
  });
  const currentRole = workspaceInfoBySlug(slug)?.role;
  const roleOptions: TRoleOption[] = Object.entries(ROLE_DETAILS)
    .filter(([key]) => currentRole !== undefined && Number(key) <= currentRole)
    .map(([key, details]) => ({ key: Number(key), label: t(details.i18n_title) }));
  const visibleCandidates = filterInviteCandidates(candidates ?? [], search);
  const selectedCandidates = (candidates ?? []).filter(
    (user) => user.invitation_status === "available" && selected[user.id] !== undefined
  );

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedCandidates.length || isSubmitting || error || isLoading) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ emails: selectedCandidates.map((user) => ({ email: user.email, role: selected[user.id] })) });
      setSelected({});
      setSearch("");
      void mutate();
    } catch {
      // The caller displays the invitation error; retain the selection for retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="lg">
        <InvitationForm
          title={t("workspace_settings.settings.members.modal.title")}
          description={t("workspace_settings.settings.members.modal.choose_users_description")}
          onSubmit={() => {
            void handleSubmit();
          }}
          actions={
            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-body-xs-regular text-secondary" aria-live="polite">
                {t("workspace_settings.settings.members.modal.selected_count", { count: selectedCandidates.length })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  stretch="auto"
                  variant="secondary"
                  size="md"
                  label={t("cancel")}
                  onClick={handleClose}
                  disabled={isSubmitting}
                />
                <Button
                  stretch="auto"
                  variant="primary"
                  size="md"
                  type="submit"
                  label={t(
                    isSubmitting
                      ? "workspace_settings.settings.members.modal.button_loading"
                      : "workspace_settings.settings.members.modal.button"
                  )}
                  loading={isSubmitting}
                  disabled={!selectedCandidates.length || !!error || isLoading || isSubmitting}
                />
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            <InputField
              orientation="vertical"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("workspace_settings.settings.members.modal.search_users")}
              aria-label={t("workspace_settings.settings.members.modal.search_users")}
              startIcon={<SearchOutline />}
              size="md"
            />
            <div className="max-h-80 min-h-40 overflow-y-auto rounded-lg border border-subtle" aria-busy={isLoading}>
              {isLoading ? (
                <p className="p-6 text-center text-body-xs-regular text-secondary">
                  {t("workspace_settings.settings.members.modal.loading_users")}
                </p>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 p-6">
                  <p role="alert" className="text-body-xs-regular text-secondary">
                    {t("workspace_settings.settings.members.modal.load_users_error")}
                  </p>
                  <Button
                    stretch="auto"
                    variant="secondary"
                    size="sm"
                    label={t("workspace_settings.settings.members.modal.retry")}
                    onClick={() => {
                      void mutate();
                    }}
                  />
                </div>
              ) : visibleCandidates.length === 0 ? (
                <p className="p-6 text-center text-body-xs-regular text-secondary">
                  {t(
                    search.trim()
                      ? "workspace_settings.settings.members.modal.no_matching_users"
                      : "workspace_settings.settings.members.modal.no_available_users"
                  )}
                </p>
              ) : (
                <ul className="divide-y divide-subtle">
                  {visibleCandidates.map((user) => {
                    const name = getInviteCandidateName(user);
                    const unavailable = user.invitation_status !== "available";
                    const checked = !unavailable && selected[user.id] !== undefined;
                    return (
                      <li
                        key={user.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5",
                          checked && "bg-layer-2",
                          unavailable && "opacity-50"
                        )}
                      >
                        <label
                          htmlFor={`invite-user-${user.id}`}
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-3",
                            unavailable ? "cursor-not-allowed" : "cursor-pointer"
                          )}
                        >
                          <Checkbox
                            id={`invite-user-${user.id}`}
                            checked={checked}
                            disabled={unavailable || isSubmitting}
                            aria-label={name}
                            onCheckedChange={() =>
                              setSelected((previous) => {
                                const next = { ...previous };
                                if (checked) delete next[user.id];
                                else next[user.id] = EUserPermissions.MEMBER;
                                return next;
                              })
                            }
                          />
                          <Avatar
                            size="sm"
                            src={getFileURL(user.avatar_url ?? "")}
                            alt=""
                            fallback={name[0]?.toUpperCase()}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-sm-medium text-primary">{name}</span>
                            <span className="block truncate text-body-xs-regular text-secondary">{user.email}</span>
                          </span>
                        </label>
                        {unavailable ? (
                          <span className="w-24 shrink-0 text-right text-body-xs-regular text-secondary">
                            {t(
                              user.invitation_status === "joined"
                                ? "workspace_settings.settings.members.modal.already_joined"
                                : "workspace_settings.settings.members.modal.already_invited"
                            )}
                          </span>
                        ) : (
                          <div className="w-24 shrink-0">
                            <Select<TRoleOption>
                              value={
                                roleOptions.find(
                                  (role) => role.key === (selected[user.id] ?? EUserPermissions.MEMBER)
                                ) ?? null
                              }
                              onChange={(value) =>
                                setSelected((previous) => ({
                                  ...previous,
                                  [user.id]: Number(value) as EUserPermissions,
                                }))
                              }
                              getValues={() => roleOptions}
                              getOptionValue={(role) => String(role.key)}
                              getOptionLabel={(role) => role.label}
                              showSearch={false}
                              placeholder={t("workspace_settings.settings.members.modal.user_role", { name })}
                              disabled={!checked || isSubmitting}
                              contentMinWidth={160}
                            >
                              <Select.Trigger<TRoleOption> variant="select-md" className="w-full">
                                <span className="min-w-0 flex-1 truncate text-left">
                                  <Select.Value />
                                </span>
                              </Select.Trigger>
                            </Select>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </InvitationForm>
      </DialogContent>
    </Dialog>
  );
});
