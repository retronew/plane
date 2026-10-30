/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "react-router";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { SearchOutline } from "@makeplane/propel/icons";
import { translate, useTranslation } from "@plane/i18n";
import { InstanceService } from "@plane/services";
import type { IInstanceUser, TInstanceUserAccountType, TInstanceUserStatus } from "@plane/types";
import { calculateTimeAgoShort, cn, renderFormattedDate, renderFormattedTime } from "@plane/utils";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import type { AccountAction } from "@/components/users/profile";
import { UserActionsMenu, UserActionConfirmation } from "@/components/users/user-actions-menu";
import { allowedAccountActions, LOGIN_MEDIUM_KEYS } from "@/components/users/profile";
import { UserNotificationPreferencesDialog } from "@/components/users/notification-preferences-dialog";
import { UserDetailsDialog } from "@/components/users/user-details-dialog";
import { UserAvatar } from "@/components/common/user-avatar";
// hooks
import { useInstance, useUser } from "@/hooks/store";
// types
import type { Route } from "./+types/page";

const instanceService = new InstanceService();

const PER_PAGE = 50;

const STATUS_FILTERS: { key: TInstanceUserStatus | "all"; label: string }[] = [
  { key: "all", label: "admin.users.filters.all" },
  { key: "active", label: "admin.users.filters.active" },
  { key: "deactivated", label: "admin.users.filters.deactivated" },
];

function StatusBadge({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-11 font-medium whitespace-nowrap", {
        "bg-success-subtle text-success-primary": active,
        "bg-danger-subtle text-danger-primary": !active,
      })}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const InstanceUsersPage = observer(function InstanceUsersPage(_props: Route.ComponentProps) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const { fetchInstanceAdmins } = useInstance();
  const { data: admins } = useSWR("INSTANCE_ADMINS", () => fetchInstanceAdmins());
  const [confirmation, setConfirmation] = useState<{
    user: IInstanceUser;
    action: AccountAction;
    session: number;
  } | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedAccountType = searchParams.get("account_type");
  const accountTypeFilter: TInstanceUserAccountType | "all" =
    requestedAccountType === "user" || requestedAccountType === "admin" ? requestedAccountType : "all";
  // states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TInstanceUserStatus | "all">("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<{ id: string; session: number } | null>(null);
  const [notificationUser, setNotificationUser] = useState<{ id: string; email: string; session: number } | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openUser = (id: string) => {
    setSelectedUser((previous) => ({ id, session: (previous?.session ?? 0) + 1 }));
    setDialogOpen(true);
  };

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

  const loginMediumLabel = (medium: string | null) => {
    if (!medium) return undefined;
    const key = LOGIN_MEDIUM_KEYS[medium];
    return key ? (key.startsWith("admin.") ? t(key) : key) : medium;
  };

  return (
    <PageWrapper
      header={{
        title: t("admin.users.title"),
        description: (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t("admin.users.description")}</span>
            {data && <span className="text-tertiary">{t("admin.users.total", { count: data.total_results })}</span>}
          </div>
        ),
      }}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 basis-full sm:max-w-xs sm:grow sm:basis-auto">
            <InputGroup size="md">
              <SearchOutline className="ms-2.5 size-4 shrink-0 text-tertiary" aria-hidden="true" />
              <Input
                size="md"
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
              }
            }}
          >
            <SelectTrigger size="md" width="fit" aria-label={t("admin.users.account_types.label")} />
            <SelectContent>
              <SelectList>
                {Object.entries(accountTypeItems).map(([value, label]) => (
                  <SelectItem key={value} value={value} label={label} size="md" />
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
              }
            }}
          >
            <SelectTrigger size="md" width="fit" aria-label={t("admin.users.filters.label")} />
            <SelectContent>
              <SelectList>
                {STATUS_FILTERS.map((filter) => (
                  <SelectItem key={filter.key} value={filter.key} label={t(filter.label)} size="md" />
                ))}
              </SelectList>
            </SelectContent>
          </Select>
        </div>

        {data ? (
          <div className="overflow-x-auto rounded-lg border border-subtle bg-surface-1">
            <table className="w-full min-w-[800px] table-fixed text-start">
              <caption className="sr-only">{t("admin.users.title")}</caption>
              <colgroup>
                <col />
                <col className="w-44" />
                <col className="w-24" />
                <col className="w-44" />
                <col className="w-28" />
                <col className="w-12" />
              </colgroup>
              <thead className="border-b border-subtle bg-layer-1 text-12 text-tertiary">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">
                    {t("admin.users.columns.user")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">
                    {t("admin.users.account_types.label")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">
                    {t("admin.users.columns.workspaces")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">
                    {t("admin.users.columns.last_login")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-start font-medium">
                    {t("admin.users.filters.label")}
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    <span className="sr-only">{t("admin.users.columns.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.results.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-13 text-tertiary">
                      {t("admin.users.empty")}
                    </td>
                  </tr>
                )}
                {data.results.map((user) => {
                  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.display_name;
                  const isSelf = user.id === currentUser?.id;
                  const roleAction = user.is_instance_admin ? "revoke" : "promote";
                  const canChangeRole = new Set(allowedAccountActions(user, currentUser?.id, admins)).has(roleAction);
                  const onAction = (action: AccountAction) => {
                    setConfirmation((previous) => ({ user, action, session: (previous?.session ?? 0) + 1 }));
                    setConfirmationOpen(true);
                  };
                  // renderFormattedDate only keeps the date part of a string, so add the time separately
                  const lastLogin = user.last_login_time
                    ? `${renderFormattedDate(user.last_login_time)} ${renderFormattedTime(user.last_login_time)}`
                    : undefined;
                  // One sign-in label per user: a linked SSO identity wins over the last method used
                  const signInMethod = user.has_sso
                    ? t("admin.users.login_medium.oidc")
                    : loginMediumLabel(user.last_login_medium);
                  return (
                    <tr
                      key={user.id}
                      className="h-[60px] border-b border-subtle transition-colors last:border-b-0 hover:bg-layer-1"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar name={name || user.email} avatarUrl={user.avatar_url} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-14 font-medium text-primary" title={name || user.email}>
                                {name || user.email}
                              </span>
                              {isSelf && (
                                <span className="shrink-0 text-11 text-tertiary">{t("admin.admins.you")}</span>
                              )}
                            </div>
                            <div className="truncate text-12 text-tertiary" title={user.email}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-12 text-secondary">
                        <Select
                          items={{ user: accountTypeItems.user, admin: accountTypeItems.admin }}
                          value={user.is_instance_admin ? "admin" : "user"}
                          disabled={!canChangeRole}
                          onValueChange={(value) => {
                            if (canChangeRole && value === (user.is_instance_admin ? "user" : "admin"))
                              onAction(roleAction);
                          }}
                        >
                          <SelectTrigger
                            size="md"
                            variant="ghost"
                            width="fit"
                            aria-label={`${t("admin.users.account_types.label")} · ${user.email}`}
                          />
                          <SelectContent>
                            <SelectList>
                              <SelectItem value="user" label={accountTypeItems.user} size="md" />
                              <SelectItem value="admin" label={accountTypeItems.admin} size="md" />
                            </SelectList>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5 text-13 text-secondary tabular-nums">{user.workspace_count}</td>
                      <td className="px-3 py-2.5 text-12 text-secondary">
                        {lastLogin ? (
                          <Tooltip label={lastLogin}>
                            <time dateTime={user.last_login_time ?? undefined}>
                              {calculateTimeAgoShort(user.last_login_time)}
                            </time>
                          </Tooltip>
                        ) : (
                          <span>{t("admin.users.never_signed_in")}</span>
                        )}
                        {signInMethod && <div className="mt-0.5 text-11 text-tertiary">{signInMethod}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge active={user.is_active}>
                          {t(user.is_active ? "admin.users.filters.active" : "admin.users.filters.deactivated")}
                        </StatusBadge>
                      </td>
                      <td className="px-2 py-2.5 text-end">
                        <UserActionsMenu
                          user={user}
                          currentUserId={currentUser?.id}
                          admins={admins}
                          onEdit={() => openUser(user.id)}
                          onNotifications={() => {
                            setNotificationUser((previous) => ({
                              id: user.id,
                              email: user.email,
                              session: (previous?.session ?? 0) + 1,
                            }));
                            setNotificationsOpen(true);
                          }}
                          onAction={onAction}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
      {confirmation && (
        <UserActionConfirmation
          key={confirmation.session}
          user={confirmation.user}
          action={confirmation.action}
          isOpen={confirmationOpen}
          onClose={() => setConfirmationOpen(false)}
        />
      )}
      {notificationUser && (
        <UserNotificationPreferencesDialog
          key={`${notificationUser.id}-${notificationUser.session}`}
          userId={notificationUser.id}
          email={notificationUser.email}
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
      )}
      {selectedUser && (
        <UserDetailsDialog
          key={selectedUser.session}
          userId={selectedUser.id}
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: translate("admin.meta.users") }];

export default InstanceUsersPage;
