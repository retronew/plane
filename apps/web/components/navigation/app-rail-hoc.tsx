/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// hoc/withDockItems.tsx
import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { InboxOutline, Projects } from "@makeplane/propel/icons";
import type { AppSidebarItemData } from "@/components/sidebar/sidebar-item";
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useWorkspacePaths } from "@/hooks/use-workspace-paths";
import { useLastWorkPath } from "@/lib/app-rail/use-last-work-path";
import { translate } from "@plane/i18n";

type WithDockItemsProps = {
  dockItems: (AppSidebarItemData & { shouldRender: boolean })[];
};

export function withDockItems<P extends WithDockItemsProps>(WrappedComponent: React.ComponentType<P>) {
  const ComponentWithDockItems = observer(function ComponentWithDockItems(props: Omit<P, keyof WithDockItemsProps>) {
    const { workspaceSlug } = useParams();
    const { isProjectsPath, isNotificationsPath, isSettingsPath } = useWorkspacePaths();
    const { unreadNotificationsCount } = useWorkspaceNotifications();
    const lastWorkPath = useLastWorkPath();
    // Away from the work area, Projects returns to the page the user came from; inside it, to the workspace home.
    const isInWorkArea = isProjectsPath && !isNotificationsPath;
    const projectsHref = isNotificationsPath || isSettingsPath ? lastWorkPath : `/${workspaceSlug}/`;
    const hasUnreadNotifications = unreadNotificationsCount.total_unread_notifications_count > 0;

    const dockItems: (AppSidebarItemData & { shouldRender: boolean })[] = [
      {
        label: translate("web.projects"),
        icon: <Projects className="size-5" />,
        href: projectsHref,
        isActive: isInWorkArea,
        shouldRender: true,
      },
      {
        label: translate("web.inbox"),
        icon: (
          <div className="relative">
            <InboxOutline className="size-5" />
            {hasUnreadNotifications && (
              <span className="absolute top-0 right-0 size-2 rounded-full bg-danger-primary" />
            )}
          </div>
        ),
        href: `/${workspaceSlug}/notifications/`,
        isActive: isNotificationsPath,
        shouldRender: true,
      },
    ];

    return <WrappedComponent {...(props as P)} dockItems={dockItems} />;
  });

  return ComponentWithDockItems;
}
