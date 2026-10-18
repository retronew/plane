/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { ENotificationLoader, ENotificationQueryParamType } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// hooks
import { useWorkspaceNotifications } from "@/hooks/store/notifications";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
import { useWorkspaceIssueProperties } from "@/hooks/use-workspace-issue-properties";
import { useNotificationPreview } from "@/hooks/use-notification-preview";
// local imports
import { InboxContentRoot } from "../inbox/content";

type NotificationsRootProps = {
  workspaceSlug?: string;
};

export const NotificationsRoot = observer(function NotificationsRoot({ workspaceSlug }: NotificationsRootProps) {
  const { t } = useTranslation();
  // hooks
  const { currentWorkspace } = useWorkspace();
  const {
    currentSelectedNotificationId,
    setCurrentSelectedNotificationId,
    notificationLiteByNotificationId,
    notificationIdsByWorkspaceId,
    getNotifications,
  } = useWorkspaceNotifications();
  const { fetchUserProjectInfo } = useUserPermissions();
  const { PeekOverviewComponent, setPeekWorkItem } = useNotificationPreview();
  // derived values
  const { workspace_slug, project_id, issue_id, is_inbox_issue } =
    notificationLiteByNotificationId(currentSelectedNotificationId);

  // fetching workspace work item properties
  useWorkspaceIssueProperties(workspaceSlug);

  // fetch workspace notifications
  const workspaceId = currentWorkspace?.id;
  const workspaceNotificationSlug = currentWorkspace?.slug;
  const hasNotifications = workspaceId ? Boolean(notificationIdsByWorkspaceId(workspaceId)) : false;
  useSWR(workspaceNotificationSlug ? `WORKSPACE_NOTIFICATION_${workspaceNotificationSlug}` : null, () =>
    workspaceNotificationSlug
      ? getNotifications(
          workspaceNotificationSlug,
          hasNotifications ? ENotificationLoader.MUTATION_LOADER : ENotificationLoader.INIT_LOADER,
          hasNotifications ? ENotificationQueryParamType.CURRENT : ENotificationQueryParamType.INIT
        )
      : undefined
  );

  const intakeProject = is_inbox_issue && workspace_slug && project_id;
  // fetching user project member info
  const { isLoading: projectMemberInfoLoader } = useSWR(
    intakeProject ? `PROJECT_MEMBER_PERMISSION_INFO_${workspace_slug}_${project_id}` : null,
    () => (intakeProject ? fetchUserProjectInfo(workspace_slug!, project_id!) : undefined)
  );

  const embedRemoveCurrentNotification = useCallback(
    () => setCurrentSelectedNotificationId(undefined),
    [setCurrentSelectedNotificationId]
  );

  // clearing up the selected notifications when unmounting the page
  useEffect(
    () => () => {
      setPeekWorkItem(undefined);
    },
    [setCurrentSelectedNotificationId, setPeekWorkItem]
  );

  return (
    <div className="h-full min-h-0 w-full min-w-0 overflow-hidden">
      {!currentSelectedNotificationId ? (
        <div className="flex size-full items-center justify-center">
          <EmptyStateDetailed
            assetKey="inbox"
            assetClassName="size-40"
            align="center"
            title={t("web.inbox_filters.empty_title")}
            description={t("web.inbox_filters.empty_description")}
          />
        </div>
      ) : (
        <>
          {intakeProject && issue_id ? (
            <>
              {projectMemberInfoLoader ? (
                <div className="flex h-full w-full items-center justify-center">
                  <LogoSpinner />
                </div>
              ) : (
                <InboxContentRoot
                  setIsMobileSidebar={() => {}}
                  isMobileSidebar={false}
                  workspaceSlug={workspace_slug}
                  projectId={project_id}
                  inboxIssueId={issue_id}
                  isNotificationEmbed
                  embedRemoveCurrentNotification={embedRemoveCurrentNotification}
                />
              )}
            </>
          ) : (
            <PeekOverviewComponent embedIssue embedRemoveCurrentNotification={embedRemoveCurrentNotification} />
          )}
        </>
      )}
    </div>
  );
});
