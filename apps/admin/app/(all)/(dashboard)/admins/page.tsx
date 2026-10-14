/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { setToast } from "@plane/blocks/toast";
import { translate, useTranslation } from "@plane/i18n";
import { InstanceService } from "@plane/services";
import type { IInstanceAdmin, IInstanceUser } from "@plane/types";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import { UserAvatar } from "@/components/common/user-avatar";
// hooks
import { useUser } from "@/hooks/store";
// types
import type { Route } from "./+types/page";

const instanceService = new InstanceService();

const ADMIN_ERROR_KEYS: Record<string, string> = {
  INVALID_EMAIL: "admin.admins.errors.invalid_email",
  USER_NOT_FOUND: "admin.admins.errors.user_not_found",
  ALREADY_ADMIN: "admin.admins.errors.already_admin",
  CANNOT_REMOVE_SELF: "admin.admins.errors.cannot_remove_self",
  LAST_ADMIN: "admin.admins.errors.last_admin",
};

const InstanceAdminsPage = observer(function InstanceAdminsPage(_props: Route.ComponentProps) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  // states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [addingUserId, setAddingUserId] = useState<string | undefined>(undefined);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | undefined>(undefined);
  const [removingId, setRemovingId] = useState<string | undefined>(undefined);
  // data
  const { data: admins, mutate } = useSWR("INSTANCE_ADMINS", () => instanceService.admins());
  const { data: users, mutate: mutateUsers } = useSWR(["INSTANCE_USER_SEARCH", debouncedSearch], () =>
    instanceService
      .listUsers({ search: debouncedSearch, status: "active", per_page: 10 })
      .then((response) => response.results)
  );

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const showError = (error: unknown) => {
    const code = (error as { error_code?: string } | undefined)?.error_code;
    setToast({
      type: "error",
      title: t("admin.common.error"),
      message: t(code && ADMIN_ERROR_KEYS[code] ? ADMIN_ERROR_KEYS[code] : "admin.admins.errors.default"),
    });
  };

  const handleAdd = async (user: IInstanceUser) => {
    setAddingUserId(user.id);
    try {
      await instanceService.addAdmin(user.email);
      await Promise.all([mutate(), mutateUsers()]);
      setToast({ type: "success", title: t("admin.common.success"), message: t("admin.admins.added") });
    } catch (error) {
      showError(error);
    } finally {
      setAddingUserId(undefined);
    }
  };

  const handleRemove = async (admin: IInstanceAdmin) => {
    setRemovingId(admin.id);
    try {
      await instanceService.removeAdmin(admin.id);
      await mutate();
      setToast({ type: "success", title: t("admin.common.success"), message: t("admin.admins.removed") });
    } catch (error) {
      showError(error);
    } finally {
      setRemovingId(undefined);
      setPendingRemovalId(undefined);
    }
  };

  const isOnlyAdmin = (admins?.length ?? 0) <= 1;

  return (
    <PageWrapper header={{ title: t("admin.admins.title"), description: t("admin.admins.description") }}>
      <div className="space-y-8">
        <div className="flex max-w-2xl flex-col gap-2">
          <label htmlFor="admin-user-search" className="text-13 text-tertiary">
            {t("admin.admins.add_label")}
          </label>
          <InputGroup size="lg">
            <Input
              size="lg"
              id="admin-user-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.admins.search_placeholder")}
              autoComplete="off"
            />
          </InputGroup>
          <div className="overflow-hidden rounded-lg border border-subtle">
            {users === undefined ? (
              <Skeleton className="flex flex-col gap-1 p-2">
                <Skeleton.Item height="40px" width="100%" />
                <Skeleton.Item height="40px" width="100%" />
              </Skeleton>
            ) : users.length === 0 ? (
              <p className="p-3 text-13 text-tertiary">{t("admin.admins.no_users")}</p>
            ) : (
              users.map((user) => {
                const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.display_name;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-4 border-b border-subtle px-3 py-2 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={name || user.email} avatarUrl={user.avatar_url} />
                      <div className="min-w-0">
                        <div className="truncate text-13 font-medium">{name}</div>
                        <div className="truncate text-11 text-tertiary">{user.email}</div>
                      </div>
                    </div>
                    {user.is_instance_admin ? (
                      <span className="shrink-0 text-11 text-tertiary">{t("admin.admins.already_admin")}</span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        stretch="auto"
                        loading={addingUserId === user.id}
                        disabled={!!addingUserId}
                        onClick={() => void handleAdd(user)}
                        label={t("admin.admins.add_button")}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
          <p className="text-11 text-tertiary">{t("admin.admins.add_hint")}</p>
        </div>

        <div className="space-y-3">
          <div className="text-16 font-medium">
            {t("admin.admins.list_title")}
            {admins && <span className="text-tertiary"> • {admins.length}</span>}
          </div>
          {admins ? (
            <div className="flex flex-col gap-2">
              {admins.map((admin) => {
                const user = admin.user_detail;
                const isSelf = admin.user === currentUser?.id;
                const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.display_name;
                return (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-layer-1 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={name || user?.email} avatarUrl={user?.avatar_url} />
                      <div className="min-w-0">
                        <div className="truncate text-14 font-medium">
                          {name}
                          {isSelf && <span className="ml-2 text-11 text-tertiary">{t("admin.admins.you")}</span>}
                        </div>
                        <div className="truncate text-13 text-tertiary">{user?.email}</div>
                      </div>
                    </div>
                    {!isSelf && !isOnlyAdmin && (
                      <div className="flex shrink-0 items-center gap-2">
                        {pendingRemovalId === admin.id ? (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              stretch="auto"
                              onClick={() => setPendingRemovalId(undefined)}
                              label={t("admin.admins.cancel")}
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              stretch="auto"
                              loading={removingId === admin.id}
                              onClick={() => void handleRemove(admin)}
                              label={t("admin.admins.confirm_remove")}
                            />
                          </>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            stretch="auto"
                            onClick={() => setPendingRemovalId(admin.id)}
                            label={t("admin.admins.remove")}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Skeleton className="flex flex-col gap-2">
              <Skeleton.Item height="58px" width="100%" />
              <Skeleton.Item height="58px" width="100%" />
            </Skeleton>
          )}
        </div>
      </div>
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: translate("admin.meta.admins") }];

export default InstanceAdminsPage;
