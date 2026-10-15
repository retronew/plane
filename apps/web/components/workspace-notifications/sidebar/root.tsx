/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { TNotificationTab } from "@plane/constants";
import { NOTIFICATION_TABS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ContentWrapper, Row, ERowVariant } from "@plane/blocks/layout";
import { cn, getNumberCount } from "@plane/utils";
// components
import { Search, X } from "lucide-react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { NotificationFilter } from "./filters/menu";
import { NotificationHeaderMenuOption } from "./header/options/menu-option";
import { CountChip } from "@/components/common/count-chip";
// hooks
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useWorkspace } from "@/hooks/store/use-workspace";
// local imports
import { NotificationEmptyState } from "./empty-state";
import { AppliedFilters } from "./filters/applied-filter";
import { NotificationSidebarHeader } from "./header";
import { NotificationsLoader } from "./loader";
import { NotificationCardListRoot } from "../notification-card/root";

export const NotificationsSidebarRoot = observer(function NotificationsSidebarRoot() {
  const { workspaceSlug } = useParams();
  // hooks
  const { getWorkspaceBySlug } = useWorkspace();
  const {
    filters,
    updateFilters,
    currentSelectedNotificationId,
    unreadNotificationsCount,
    loader,
    notificationIdsByWorkspaceId,
    currentNotificationTab,
    setCurrentNotificationTab,
  } = useWorkspaceNotifications();

  const { t } = useTranslation();
  const searchInput = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  const [search, setSearch] = useState(filters.search ?? "");
  useEffect(() => {
    if (search === (filters.search ?? "")) return;
    const timer = window.setTimeout(() => updateFilters("search", search), 250);
    return () => window.clearTimeout(timer);
  }, [search, filters.search, updateFilters]);
  // derived values
  const workspace = workspaceSlug ? getWorkspaceBySlug(workspaceSlug.toString()) : undefined;
  const notificationIds = workspace ? notificationIdsByWorkspaceId(workspace.id) : undefined;

  const handleTabClick = useCallback(
    (tabValue: TNotificationTab) => {
      if (currentNotificationTab !== tabValue) {
        setCurrentNotificationTab(tabValue);
      }
    },
    [currentNotificationTab, setCurrentNotificationTab]
  );

  if (!workspaceSlug || !workspace) return <></>;

  return (
    <div
      className={cn(
        "relative z-[10] h-full flex-shrink-0 border-0 border-subtle bg-surface-1 max-md:overflow-hidden md:border-r",
        currentSelectedNotificationId ? "w-0 md:w-3/12 md:min-w-80" : "w-full md:w-3/12 md:min-w-80"
      )}
    >
      <div className="relative flex h-full w-full flex-col">
        <Row className="flex h-12 flex-shrink-0 px-5">
          <NotificationSidebarHeader workspaceSlug={workspaceSlug.toString()} />
        </Row>

        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-subtle px-5">
          <div
            role="tablist"
            aria-label={t("notification.label")}
            className="inline-flex gap-px rounded-lg bg-layer-3 p-0.5"
          >
            {NOTIFICATION_TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={currentNotificationTab === tab.value}
                key={tab.value}
                onClick={() => handleTabClick(tab.value)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-md px-2 text-12 font-medium",
                  currentNotificationTab === tab.value
                    ? "shadow-sm bg-surface-1 text-primary"
                    : "text-secondary hover:text-primary"
                )}
              >
                {t(tab.i18n_label)}
                {tab.count(unreadNotificationsCount) > 0 && (
                  <CountChip count={getNumberCount(tab.count(unreadNotificationsCount))} />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              size="sm"
              variant="secondary"
              icon={<Search className="size-3.5" />}
              aria-label={t("search")}
              onClick={() => setSearchOpen((value) => !value)}
            />
            <NotificationFilter />
            <NotificationHeaderMenuOption />
          </div>
        </div>
        {(searchOpen || search) && (
          <div className="flex items-center gap-2 border-b border-subtle px-5 py-2">
            <Search className="size-3.5 shrink-0 text-tertiary" />
            <input
              ref={searchInput}
              aria-label={t("web.inbox_filters.search")}
              placeholder={t("web.inbox_filters.search")}
              className="h-6 min-w-0 flex-1 bg-transparent text-12 outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearch("");
                  setSearchOpen(false);
                }
              }}
            />
            <IconButton
              size="sm"
              variant="ghost"
              icon={<X className="size-3" />}
              aria-label={t("common.clear_all")}
              onClick={() => {
                setSearch("");
                setSearchOpen(false);
              }}
            />
          </div>
        )}

        {/* applied filters */}
        <AppliedFilters workspaceSlug={workspaceSlug.toString()} />

        {/* rendering notifications */}
        {loader === "init-loader" ? (
          <div className="relative h-full w-full overflow-hidden">
            <NotificationsLoader />
          </div>
        ) : (
          <>
            {notificationIds && notificationIds.length > 0 ? (
              <ContentWrapper variant={ERowVariant.HUGGING}>
                <NotificationCardListRoot workspaceSlug={workspaceSlug.toString()} workspaceId={workspace?.id} />
              </ContentWrapper>
            ) : (
              <div className="relative flex h-full w-full items-center justify-center">
                <NotificationEmptyState currentNotificationTab={currentNotificationTab} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
