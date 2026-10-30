/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useImperativeHandle, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { InstanceService } from "@plane/services";
import type { IInstanceUserDetail, TInstanceUserProfile } from "@plane/types";
import { renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import { UserAvatar } from "@/components/common/user-avatar";
import { useUser } from "@/hooks/store";
import {
  LOGIN_MEDIUM_KEYS,
  isInstanceUserCacheKey,
  normalizeProfile,
  PROFILE_FIELDS,
  profileValues,
  validateProfileName,
} from "./profile";

const service = new InstanceService();
const ROLE_KEYS: Record<number, string> = { 5: "guest", 10: "viewer", 15: "member", 20: "admin" };

type Props = { userId: string; isOpen: boolean; onClose: () => void };

export function UserDetailsDialog({ userId, isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const { data, error, mutate } = useSWR(["INSTANCE_USER", userId], () => service.getUser(userId));
  const formRef = useRef<{ isDirty: () => boolean }>(null);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const close = () => {
    if (busy) return;
    if (formRef.current?.isDirty()) setDiscard(true);
    else onClose();
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent size="lg">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("admin.users.details.title")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody tabIndex={0}>
            {data ? (
              <UserDetailsForm
                key={data.id}
                user={data}
                refresh={() => mutate()}
                ref={formRef}
                onBusyChange={setBusy}
              />
            ) : (
              <div className="space-y-3 py-6 text-13 text-secondary" aria-live="polite">
                {t(error ? "admin.users.errors.default" : "admin.users.details.loading")}
                {error && (
                  <Button
                    stretch="auto"
                    variant="secondary"
                    size="sm"
                    label={t("admin.users.details.retry")}
                    onClick={() => void mutate()}
                  />
                )}
              </div>
            )}
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button
            stretch="auto"
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={close}
            label={t("admin.common.close")}
          />
        </DialogActions>
      </DialogContent>
      <ConfirmDiscardModal
        isOpen={discard}
        handleClose={() => setDiscard(false)}
        onDiscard={() => {
          setDiscard(false);
          onClose();
        }}
      />
    </Dialog>
  );
}

const UserDetailsForm = observer(function UserDetailsForm({
  user,
  refresh,
  ref,
  onBusyChange,
}: {
  user: IInstanceUserDetail;
  refresh: () => Promise<unknown>;
  ref: React.Ref<{ isDirty: () => boolean }>;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const { fetchCurrentUser } = useUser();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Cache revalidation updates account metadata, while RHF retains the user's draft.
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<TInstanceUserProfile>({ defaultValues: profileValues(user) });
  useImperativeHandle(ref, () => ({ isDirty: () => isDirty }), [isDirty]);
  const run = async (operation: () => Promise<unknown>, successKey: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    setFailure(null);
    try {
      await operation();
      setToast({ type: "success", title: t("admin.common.success"), message: t(successKey) });
      const results = await Promise.allSettled([
        refresh(),
        mutate(isInstanceUserCacheKey),
        mutate("INSTANCE_ADMINS"),
        fetchCurrentUser(),
      ]);
      if (results.some((result) => result.status === "rejected")) setFailure(t("admin.users.details.refresh_failed"));
    } catch {
      setFailure(t("admin.users.errors.default"));
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  const save = handleSubmit((values) =>
    run(async () => {
      const updated = await service.updateUser(user.id, normalizeProfile(values));
      reset(profileValues(updated));
    }, "admin.users.details.saved")
  );
  return (
    <div className="min-w-0 space-y-6">
      <UserMetadata user={user} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <h3 className="text-14 font-medium">{t("admin.users.details.profile")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PROFILE_FIELDS.map((field) => (
            <div key={field} className="space-y-1.5">
              <label htmlFor={`instance-user-${field}`} className="text-13 text-secondary">
                {t(`admin.users.details.${field}`)}
              </label>
              <InputGroup size="md">
                <Input
                  size="md"
                  id={`instance-user-${field}`}
                  disabled={busy}
                  autoComplete="off"
                  aria-invalid={!!errors[field]}
                  aria-describedby={errors[field] ? `error-${field}` : undefined}
                  {...register(field, {
                    validate: (value) => {
                      const error = validateProfileName(value, field === "display_name");
                      return error ? t(`admin.users.details.validation.${error}`) : true;
                    },
                  })}
                />
              </InputGroup>
              {errors[field] && (
                <p id={`error-${field}`} className="text-12 text-danger-primary">
                  {errors[field]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        <Button
          stretch="auto"
          type="submit"
          variant="primary"
          size="md"
          disabled={busy || !isDirty}
          loading={busy}
          label={t("admin.common.save_changes")}
        />
      </form>
      <section className="space-y-3 border-t border-subtle pt-4">
        <h3 className="text-14 font-medium">{t("admin.users.columns.workspaces")}</h3>
        {user.workspaces.length ? (
          <ul className="divide-y divide-subtle">
            {user.workspaces.map((workspace) => (
              <li key={workspace.id} className="flex flex-wrap justify-between gap-2 py-2 text-13">
                <div className="min-w-0">
                  <p className="break-all">{workspace.name}</p>
                  <p className="text-12 break-all text-tertiary">{workspace.slug}</p>
                </div>
                <span className="text-secondary">
                  {t(`admin.users.details.roles.${ROLE_KEYS[workspace.role] || "unknown"}`)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-13 text-tertiary">{t("admin.users.details.no_workspaces")}</p>
        )}
      </section>
      {failure && (
        <p role="alert" className="text-13 text-danger-primary">
          {failure}
        </p>
      )}
    </div>
  );
});

function UserMetadata({ user }: { user: IInstanceUserDetail }) {
  const { t } = useTranslation();
  const date = (value: string | null) =>
    value ? `${renderFormattedDate(value)} ${renderFormattedTime(value)}` : t("admin.users.never_signed_in");
  const mediumKey = user.last_login_medium ? LOGIN_MEDIUM_KEYS[user.last_login_medium] : undefined;
  const loginMedium = mediumKey ? (mediumKey.startsWith("admin.") ? t(mediumKey) : mediumKey) : user.last_login_medium;
  const metadata = [
    ["email", user.email],
    ["id", user.id],
    ["date_joined", date(user.date_joined)],
    ["last_login", date(user.last_login_time)],
    ["login_medium", loginMedium || t("admin.users.details.none")],
    ["sso", t(user.has_sso ? "admin.users.details.linked" : "admin.users.details.not_linked")],
    ["status", t(user.is_active ? "admin.users.filters.active" : "admin.users.filters.deactivated")],
    ["role", t(user.is_instance_admin ? "admin.users.account_types.admin" : "admin.users.account_types.user")],
  ];
  return (
    <>
      <div className="flex items-center gap-3">
        <UserAvatar name={user.display_name || user.email} avatarUrl={user.avatar_url} />
        <span className="min-w-0 text-14 font-medium break-all">{user.display_name || user.email}</span>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-13 sm:grid-cols-2">
        {metadata.map(([key, value]) => (
          <div key={key} className="min-w-0">
            <dt className="text-tertiary">{t(`admin.users.details.${key}`)}</dt>
            <dd className="break-all text-secondary">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
