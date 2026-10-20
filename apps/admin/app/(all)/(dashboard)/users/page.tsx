/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "react-router";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { setToast } from "@plane/blocks/toast";
import { translate, useTranslation } from "@plane/i18n";
import { InstanceService } from "@plane/services";
import type { IInstanceUser, TInstanceUserAccountType, TInstanceUserStatus } from "@plane/types";
import { cn, renderFormattedDate, renderFormattedTime } from "@plane/utils";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import { UserAvatar } from "@/components/common/user-avatar";
// hooks
import { useInstance, useUser } from "@/hooks/store";
// types
import type { Route } from "./+types/page";

const instanceService = new InstanceService();

const PER_PAGE = 50;

// Fixed columns keep every row aligned whatever actions it shows
const ROW_GRID = "grid grid-cols-1 items-center gap-3 xl:grid-cols-[minmax(12rem,1fr)_8rem_5rem_10rem_15rem] xl:gap-4";

const STATUS_FILTERS: { key: TInstanceUserStatus | "all"; label: string }[] = [
  { key: "all", label: "admin.users.filters.all" },
  { key: "active", label: "admin.users.filters.active" },
  { key: "deactivated", label: "admin.users.filters.deactivated" },
];

const USER_ERROR_KEYS: Record<string, string> = {
  CANNOT_DEACTIVATE_SELF: "admin.users.errors.cannot_deactivate_self",
  USER_IS_ADMIN: "admin.users.errors.user_is_admin",
  ALREADY_ADMIN: "admin.admins.errors.already_admin",
  USER_NOT_FOUND: "admin.admins.errors.user_not_found",
  CANNOT_REMOVE_SELF: "admin.admins.errors.cannot_remove_self",
  LAST_ADMIN: "admin.admins.errors.last_admin",
};

// Values stored in last_login_medium; anything else is shown as-is
const LOGIN_MEDIUM_KEYS: Record<string, string> = {
  oidc: "admin.users.login_medium.oidc",
  email: "admin.users.login_medium.email",
  "magic-code": "admin.users.login_medium.magic_code",
  google: "Google",
  github: "GitHub",
  gitlab: "GitLab",
  gitea: "Gitea",
};

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "danger" }) {
  return (
    <span
      className={cn("rounded-sm px-1.5 py-0.5 text-11 font-medium", {
        "bg-layer-2 text-secondary": tone === "neutral",
        "bg-accent-subtle text-accent-primary": tone === "accent",
        "bg-danger-subtle text-danger-primary": tone === "danger",
      })}
    >
      {children}
    </span>
  );
}

const InstanceUsersPage = observer(function InstanceUsersPage(_props: Route.ComponentProps) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const { fetchInstanceAdmins } = useInstance();
  const { mutate: mutateCache } = useSWRConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedAccountType = searchParams.get("account_type");
  const accountTypeFilter: TInstanceUserAccountType | "all" =
    requestedAccountType === "user" || requestedAccountType === "admin" ? requestedAccountType : "all";
  const { data: admins } = useSWR("INSTANCE_ADMINS", () => fetchInstanceAdmins());
  // states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TInstanceUserStatus | "all">("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [pendingDeactivationId, setPendingDeactivationId] = useState<string | undefined>(undefined);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | undefined>(undefined);
  const [busyUserId, setBusyUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setCursor(undefined);
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const accountTypeItems = {
    all: t("admin.users.account_types.all"),
    user: t("admin.users.account_types.user"),
    admin: t("admin.users.account_types.admin"),
  };

  const { data } = useSWR(["INSTANCE_USERS", debouncedSearch, statusFilter, accountTypeFilter, cursor], () =>
    instanceService.listUsers({
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      account_type: accountTypeFilter === "all" ? undefined : accountTypeFilter,
      per_page: PER_PAGE,
      cursor,
    })
  );

  const showError = (error: unknown) => {
    const code = (error as { error_code?: string } | undefined)?.error_code;
    setToast({
      type: "error",
      title: t("admin.common.error"),
      message: t(code && USER_ERROR_KEYS[code] ? USER_ERROR_KEYS[code] : "admin.users.errors.default"),
    });
  };

  const runAction = async (user: IInstanceUser, action: () => Promise<unknown>, successKey: string) => {
    setBusyUserId(user.id);
    try {
      await action();
      await Promise.all([
        mutateCache((key) => Array.isArray(key) && key[0] === "INSTANCE_USERS"),
        mutateCache("INSTANCE_ADMINS"),
      ]);
      setToast({ type: "success", title: t("admin.common.success"), message: t(successKey) });
    } catch (error) {
      showError(error);
    } finally {
      setBusyUserId(undefined);
      setPendingDeactivationId(undefined);
      setPendingRemovalId(undefined);
    }
  };

  const loginMediumLabel = (medium: string | null) => {
    if (!medium) return undefined;
    const key = LOGIN_MEDIUM_KEYS[medium];
    return key ? (key.startsWith("admin.") ? t(key) : key) : medium;
  };

  return (
    <PageWrapper header={{ title: t("admin.users.title"), description: t("admin.users.description") }}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 basis-full sm:max-w-sm sm:grow sm:basis-auto">
            <InputGroup size="lg">
              <Input
                size="lg"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin.users.search_placeholder")}
                aria-label={t("admin.users.search_placeholder")}
                autoComplete="off"
              />
            </InputGroup>
          </div>
          <Select
            items={accountTypeItems}
            value={accountTypeFilter}
            onValueChange={(value) => {
              if (value === "all" || value === "user" || value === "admin") {
                setSearchParams(
                  (params) => {
                    if (value === "all") params.delete("account_type");
                    else params.set("account_type", value);
                    return params;
                  },
                  { replace: true }
                );
                setCursor(undefined);
                setPendingRemovalId(undefined);
                setPendingDeactivationId(undefined);
              }
            }}
          >
            <SelectTrigger size="lg" width="fit" aria-label={t("admin.users.account_types.label")} />
            <SelectContent>
              <SelectList>
                {Object.entries(accountTypeItems).map(([value, label]) => (
                  <SelectItem key={value} value={value} label={label} size="lg" />
                ))}
              </SelectList>
            </SelectContent>
          </Select>
          <Select
            items={Object.fromEntries(STATUS_FILTERS.map((filter) => [filter.key, t(filter.label)]))}
            value={statusFilter}
            onValueChange={(value) => {
              if (value === "all" || value === "active" || value === "deactivated") {
                setStatusFilter(value);
                setCursor(undefined);
                setPendingRemovalId(undefined);
                setPendingDeactivationId(undefined);
              }
            }}
          >
            <SelectTrigger size="lg" width="fit" aria-label={t("admin.users.filters.label")} />
            <SelectContent>
              <SelectList>
                {STATUS_FILTERS.map((filter) => (
                  <SelectItem key={filter.key} value={filter.key} label={t(filter.label)} size="lg" />
                ))}
              </SelectList>
            </SelectContent>
          </Select>
          {data && (
            <span className="ms-auto px-1 text-12 whitespace-nowrap text-tertiary">
              {t("admin.users.total", { count: data.total_results })}
            </span>
          )}
        </div>

        {data ? (
          <div className="overflow-hidden rounded-lg border border-subtle">
            <div
              className={cn(
                ROW_GRID,
                "hidden border-b border-subtle bg-layer-1 px-4 py-3 text-12 text-tertiary xl:grid"
              )}
            >
              <span>{t("admin.users.columns.user")}</span>
              <span>{t("admin.users.account_types.label")}</span>
              <span>{t("admin.users.columns.workspaces")}</span>
              <span>{t("admin.users.columns.last_login")}</span>
              <span className="text-end">{t("admin.users.columns.actions")}</span>
            </div>
            {data.results.length === 0 && (
              <p className="px-4 py-12 text-center text-13 text-tertiary">{t("admin.users.empty")}</p>
            )}
            {data.results.map((user) => {
              const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.display_name;
              const isSelf = user.id === currentUser?.id;
              const isBusy = busyUserId === user.id;
              const admin = admins?.find((entry) => entry.user === user.id);
              const canRemoveAdmin = !isSelf && !!admin && (admins?.length ?? 0) > 1;
              // renderFormattedDate only keeps the date part of a string, so add the time separately
              const lastLogin = user.last_login_time
                ? `${renderFormattedDate(user.last_login_time)} ${renderFormattedTime(user.last_login_time)}`
                : undefined;
              // One sign-in label per user: a linked SSO identity wins over the last method used
              const signInMethod = user.has_sso
                ? t("admin.users.login_medium.oidc")
                : loginMediumLabel(user.last_login_medium);
              return (
                <div
                  key={user.id}
                  className={cn(
                    ROW_GRID,
                    "border-b border-subtle px-4 py-4 transition-colors last:border-b-0 hover:bg-layer-1"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar name={name || user.email} avatarUrl={user.avatar_url} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-14 font-medium">{name}</span>
                        {isSelf && <span className="text-11 text-tertiary">{t("admin.admins.you")}</span>}
                        {!user.is_active && <Badge tone="danger">{t("admin.users.badges.deactivated")}</Badge>}
                      </div>
                      <div className="truncate text-13 text-tertiary">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-12 text-secondary">
                    <span className="text-tertiary xl:hidden">{t("admin.users.account_types.label")}</span>
                    {user.is_instance_admin ? (
                      <Badge tone="accent">{t("admin.users.account_types.admin")}</Badge>
                    ) : (
                      <span>{t("admin.users.account_types.user")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-13 text-secondary">
                    <span className="text-12 text-tertiary xl:hidden">{t("admin.users.columns.workspaces")}</span>
                    <span className="tabular-nums">{user.workspace_count}</span>
                  </div>
                  <div className="space-y-1 text-12 text-secondary">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-tertiary xl:hidden">{t("admin.users.columns.last_login")}</span>
                      <span>{lastLogin ?? t("admin.users.never_signed_in")}</span>
                    </div>
                    {signInMethod && <div className="text-11 text-tertiary">{signInMethod}</div>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-subtle pt-3 xl:justify-end xl:border-0 xl:pt-0">
                    {user.is_instance_admin &&
                      canRemoveAdmin &&
                      admin &&
                      (pendingRemovalId === user.id ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            stretch="auto"
                            disabled={isBusy}
                            onClick={() => setPendingRemovalId(undefined)}
                            label={t("admin.admins.cancel")}
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            stretch="auto"
                            loading={isBusy}
                            onClick={() =>
                              void runAction(user, () => instanceService.removeAdmin(admin.id), "admin.admins.removed")
                            }
                            label={t("admin.admins.confirm_remove")}
                          />
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          stretch="auto"
                          disabled={!!busyUserId}
                          onClick={() => {
                            setPendingRemovalId(user.id);
                            setPendingDeactivationId(undefined);
                          }}
                          label={t("admin.admins.remove")}
                        />
                      ))}
                    {user.is_active && !user.is_instance_admin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        stretch="auto"
                        disabled={isBusy}
                        onClick={() =>
                          void runAction(user, () => instanceService.addAdmin(user.email), "admin.admins.added")
                        }
                        label={t("admin.admins.add_button")}
                      />
                    )}
                    {user.is_active ? (
                      !isSelf &&
                      !user.is_instance_admin &&
                      (pendingDeactivationId === user.id ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            stretch="auto"
                            onClick={() => setPendingDeactivationId(undefined)}
                            label={t("admin.admins.cancel")}
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            stretch="auto"
                            loading={isBusy}
                            onClick={() =>
                              void runAction(
                                user,
                                () => instanceService.deactivateUser(user.id),
                                "admin.users.deactivated"
                              )
                            }
                            label={t("admin.users.confirm_deactivate")}
                          />
                        </>
                      ) : (
                        <Button
                          variant="danger-outline"
                          size="sm"
                          stretch="auto"
                          disabled={isBusy}
                          onClick={() => setPendingDeactivationId(user.id)}
                          label={t("admin.users.deactivate")}
                        />
                      ))
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        stretch="auto"
                        loading={isBusy}
                        onClick={() =>
                          void runAction(user, () => instanceService.activateUser(user.id), "admin.users.activated")
                        }
                        label={t("admin.users.activate")}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Skeleton className="flex flex-col gap-2">
            <Skeleton.Item height="60px" width="100%" />
            <Skeleton.Item height="60px" width="100%" />
            <Skeleton.Item height="60px" width="100%" />
          </Skeleton>
        )}

        {data && (data.prev_page_results || data.next_page_results) && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              stretch="auto"
              disabled={!data.prev_page_results}
              onClick={() => setCursor(data.prev_cursor)}
              label={t("admin.users.previous_page")}
            />
            <Button
              variant="secondary"
              size="sm"
              stretch="auto"
              disabled={!data.next_page_results}
              onClick={() => setCursor(data.next_cursor)}
              label={t("admin.users.next_page")}
            />
          </div>
        )}

        <div className="space-y-2 text-11 text-tertiary">
          <p>{t("admin.users.admin_hint")}</p>
          <p>{t("admin.users.deactivate_hint")}</p>
        </div>
      </div>
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: translate("admin.meta.users") }];

export default InstanceUsersPage;
