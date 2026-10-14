/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { observer } from "mobx-react";
// plane imports
import { ENotificationTab } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/blocks/empty-state";

type TNotificationEmptyStateProps = {
  currentNotificationTab: ENotificationTab;
};

export const NotificationEmptyState = observer(function NotificationEmptyState({
  currentNotificationTab,
}: TNotificationEmptyStateProps) {
  // plane imports
  const { t } = useTranslation();
  const { filters } = useWorkspaceNotifications();
  const filtered = Boolean(
    filters.search?.trim() ||
    Object.values(filters.type).some(Boolean) ||
    [filters.priority, filters.state_group, filters.assignees, filters.triggered_by, filters.project].some(
      (values) => values?.length
    )
  );

  return (
    <>
      <EmptyStateCompact
        assetKey="inbox"
        assetClassName="size-24"
        title={
          filtered
            ? t("web.inbox_filters.no_results")
            : currentNotificationTab === ENotificationTab.ALL
              ? t("workspace_empty_state.inbox_sidebar_all.title")
              : t("workspace_empty_state.inbox_sidebar_mentions.title")
        }
        className="max-w-72 px-3"
      />
    </>
  );
});
