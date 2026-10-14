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
import type { IInstanceUser, TInstanceUserStatus } from "@plane/types";
import { cn, renderFormattedDate, renderFormattedTime } from "@plane/utils";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import { UserAvatar } from "@/components/common/user-avatar";
// hooks
import { useUser } from "@/hooks/store";
// types
import type { Route } from "./+types/page";

const instanceService = new InstanceService();

const PER_PAGE = 50;

// Fixed columns keep every row aligned whatever actions it shows
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 md:grid-cols-[minmax(0,1fr)_5rem_10rem_15rem]";

const STATUS_FILTERS: { key: TInstanceUserStatus | "all"; label: string }[] = [
  { key: "all", label: "admin.users.filters.all" },
  { key: "active", label: "admin.users.filters.active" },
  { key: "deactivated", label: "admin.users.filters.deactivated" },
];

const USER_ERROR_KEYS: Record<string, string> = {
  CANNOT_DEACTIVATE_SELF: "admin.users.errors.cannot_deactivate_self",
  USER_IS_ADMIN: "admin.users.errors.user_is_admin",
  ALREADY_ADMIN: "admin.admins.errors.already_admin",
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
  // states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TInstanceUserStatus | "all">("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [pendingDeactivationId, setPendingDeactivationId] = useState<string | undefined>(undefined);
  const [busyUserId, setBusyUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setCursor(undefined);
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, mutate } = useSWR(["INSTANCE_USERS", debouncedSearch, statusFilter, cursor], () =>
    instanceService.listUsers({
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
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
      await mutate();
      setToast({ type: "success", title: t("admin.common.success"), message: t(successKey) });
    } catch (error) {
      showError(error);
    } finally {
      setBusyUserId(undefined);
      setPendingDeactivationId(undefined);
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
          <div className="max-w-sm grow">
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
          <fieldset className="m-0 flex items-center gap-1 border-0 p-0">
            <legend className="sr-only">{t("admin.users.filters.label")}</legend>
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.key}
                variant={statusFilter === filter.key ? "secondary" : "ghost"}
                size="md"
                stretch="auto"
                aria-pressed={statusFilter === filter.key}
                onClick={() => {
                  setStatusFilter(filter.key);
                  setCursor(undefined);
                }}
                label={t(filter.label)}
              />
            ))}
          </fieldset>
          {data && (
            <span className="text-13 text-tertiary">{t("admin.users.total", { count: data.total_results })}</span>
          )}
        </div>

        {data ? (
          data.results.length === 0 ? (
            <p className="rounded-lg border border-subtle p-6 text-center text-13 text-tertiary">
              {t("admin.users.empty")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-subtle">
              <div className={cn(ROW_GRID, "border-b border-subtle bg-layer-1 px-4 py-2 text-12 text-tertiary")}>
                <span>{t("admin.users.columns.user")}</span>
                <span className="hidden md:block">{t("admin.users.columns.workspaces")}</span>
                <span className="hidden md:block">{t("admin.users.columns.last_login")}</span>
                <span className="text-right">{t("admin.users.columns.actions")}</span>
              </div>
              {data.results.map((user) => {
                const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.display_name;
                const isSelf = user.id === currentUser?.id;
                const isBusy = busyUserId === user.id;
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
                    className={cn(ROW_GRID, "border-b border-subtle px-4 py-3 last:border-b-0", {
                      "opacity-60": !user.is_active,
                    })}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={name || user.email} avatarUrl={user.avatar_url} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-14 font-medium">{name}</span>
                          {isSelf && <span className="text-11 text-tertiary">{t("admin.admins.you")}</span>}
                          {user.is_instance_admin && <Badge tone="accent">{t("admin.users.badges.admin")}</Badge>}
                          {signInMethod && <Badge>{signInMethod}</Badge>}
                          {!user.is_active && <Badge tone="danger">{t("admin.users.badges.deactivated")}</Badge>}
                        </div>
                        <div className="truncate text-13 text-tertiary">{user.email}</div>
                      </div>
                    </div>

                    <span className="hidden text-13 text-secondary md:block">{user.workspace_count}</span>
                    <span className="hidden text-13 text-secondary md:block">
                      {lastLogin ?? <span className="text-tertiary">{t("admin.users.never_signed_in")}</span>}
                    </span>

                    <div className="flex items-center justify-end gap-2">
                      {user.is_active && !user.is_instance_admin && (
                        <Button
                          variant="ghost"
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
                            variant="secondary"
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
          )
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

        <p className="text-11 text-tertiary">{t("admin.users.deactivate_hint")}</p>
      </div>
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: translate("admin.meta.users") }];

export default InstanceUsersPage;
