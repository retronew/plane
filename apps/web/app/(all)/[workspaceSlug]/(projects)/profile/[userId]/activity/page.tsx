/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel, USER_PROFILE_ACTIVITY } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
// services
import { UserService } from "@/services/user.service";
// components
import { PageHead } from "@/components/core/page-title";
import { DownloadActivityButton } from "@/components/profile/activity/download-button";
import { WorkspaceActivityListPage } from "@/components/profile/activity/workspace-activity-list";
// hooks
import { useUserPermissions } from "@/hooks/store/user";

const PER_PAGE = 100;

// services
const userService = new UserService();

function ProfileActivityPage() {
  // states
  const [pageCount, setPageCount] = useState(1);
  // router
  const { workspaceSlug, userId } = useParams();
  const { allowPermissions } = useUserPermissions();
  //hooks
  const { t } = useTranslation();

  // The first page owns the paging affordance; the list components share this SWR cache entry,
  // so nothing is fetched twice.
  const firstPageCursor = `${PER_PAGE}:0:0`;
  const { data: firstPage } = useSWR(
    workspaceSlug && userId
      ? USER_PROFILE_ACTIVITY(workspaceSlug.toString(), userId.toString(), { cursor: firstPageCursor })
      : null,
    workspaceSlug && userId
      ? () =>
          userService.getUserProfileActivity(workspaceSlug.toString(), userId.toString(), {
            cursor: firstPageCursor,
            per_page: PER_PAGE,
          })
      : null
  );
  const totalPages = firstPage?.total_pages ?? 0;
  const resultsCount = firstPage?.results.length ?? 0;

  const handleLoadMore = () => setPageCount((prev) => prev + 1);

  const activityPages: React.ReactNode[] = [];
  for (let i = 0; i < pageCount; i++)
    activityPages.push(<WorkspaceActivityListPage key={i} cursor={`${PER_PAGE}:${i}:0`} perPage={PER_PAGE} />);

  const canDownloadActivity = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  return (
    <>
      <PageHead title={t("profile.page_title", { tab: t("profile.tabs.activity") })} />
      <div className="flex h-full w-full flex-col overflow-hidden py-5">
        <div className="flex items-center justify-between gap-2 px-5 md:px-9">
          <h3 className="text-16 font-medium">{t("profile.stats.recent_activity.title")}</h3>
          {canDownloadActivity && <DownloadActivityButton />}
        </div>
        <div className="vertical-scrollbar scrollbar-md flex h-full flex-col overflow-y-auto px-5 md:px-9">
          {activityPages}
          {pageCount < totalPages && resultsCount !== 0 && (
            <div className="flex w-full items-center justify-center text-11">
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("common.load_more")}
                onClick={handleLoadMore}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default observer(ProfileActivityPage);
