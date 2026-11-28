/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { ENotificationLoader, ENotificationQueryParamType } from "@plane/constants";
import { Loader } from "@plane/blocks/skeleton";
import { useTranslation } from "@plane/i18n";
// components
import { NotificationItem } from "@/components/workspace-notifications/sidebar/notification-card/item";
// hooks
import { useWorkspaceNotifications } from "@/hooks/store/notifications";

type TNotificationCardListRoot = {
  workspaceSlug: string;
  workspaceId: string;
};

export const NotificationCardListRoot = observer(function NotificationCardListRoot(props: TNotificationCardListRoot) {
  const { workspaceSlug, workspaceId } = props;
  // hooks
  const { loader, paginationInfo, getNotifications, notificationIdsByWorkspaceId } = useWorkspaceNotifications();
  const notificationIds = notificationIdsByWorkspaceId(workspaceId);
  const { t } = useTranslation();

  const getNextNotifications = async () => {
    try {
      await getNotifications(workspaceSlug, ENotificationLoader.PAGINATION_LOADER, ENotificationQueryParamType.NEXT);
    } catch (error) {
      console.error(error);
    }
  };

  if (!workspaceSlug || !workspaceId || !notificationIds) return <></>;
  return (
    <div>
      {notificationIds.map((notificationId: string) => (
        <NotificationItem key={notificationId} workspaceSlug={workspaceSlug} notificationId={notificationId} />
      ))}

      {/* fetch next page notifications */}
      {paginationInfo && paginationInfo?.next_page_results && (
        <>
          {loader === ENotificationLoader.PAGINATION_LOADER ? (
            <Loader className="space-y-3 p-3">
              {Array.from({ length: 2 }).map((_, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <div key={index} className="flex items-center gap-3">
                  <Loader.Item width="36px" height="36px" className="shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Loader.Item width="70%" height="14px" />
                    <Loader.Item width="45%" height="12px" />
                  </div>
                </div>
              ))}
            </Loader>
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-center py-4 text-13 font-medium"
              onClick={getNextNotifications}
            >
              <span className="cursor-pointer text-accent-secondary transition-all hover:text-accent-primary">
                {t("load_more")}
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
});
