/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChatOutline, HistoryOutline } from "@makeplane/propel/icons";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";
import type { IUserActivityResponse } from "@plane/types";
import { calculateTimeAgo, getFileURL, renderFormattedDate, renderFormattedTime } from "@plane/utils";
import { ActivityIcon, ActivityMessage } from "@/components/core/activity";
import { RichTextEditor } from "@/components/editor/rich-text";
import { ActivitySettingsLoader } from "@/components/ui/loader/settings/activity";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser } from "@/hooks/store/user";

export const ActivityList = observer(function ActivityList({
  activity,
}: {
  activity: IUserActivityResponse | undefined;
}) {
  const { workspaceSlug } = useParams();
  const { data: currentUser } = useUser();
  const { getWorkspaceBySlug } = useWorkspace();
  const { t } = useTranslation();
  const workspaceId = getWorkspaceBySlug(workspaceSlug?.toString() ?? "")?.id ?? "";

  if (!activity) return <ActivitySettingsLoader />;

  return (
    <ul>
      {activity.results
        .filter((item) => item.field !== "updated_by")
        .map((item) => {
          const isComment = item.field === "comment";
          const actor = item.actor_detail;
          const actorName = actor.is_bot
            ? `${actor.first_name} ${t("web.bot")}`
            : currentUser?.id === actor.id
              ? t("web.you")
              : actor.display_name;
          return (
            <li key={item.id} className="border-b border-subtle py-3">
              <div className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center text-secondary" data-activity-icon="">
                  {isComment ? (
                    <ChatOutline className="size-4" aria-hidden="true" />
                  ) : item.new_value === "restore" ? (
                    <HistoryOutline className="size-4" aria-hidden="true" />
                  ) : item.field ? (
                    <ActivityIcon activity={item} size={16} />
                  ) : (
                    <Avatar alt={actor.display_name} src={getFileURL(actor.avatar_url)} size="sm" />
                  )}
                </span>
                <p className="min-w-0 flex-1 text-body-xs-regular leading-relaxed break-words text-secondary">
                  {item.field === "archived_at" && item.new_value !== "restore" ? (
                    <span className="font-medium text-primary">Plane</span>
                  ) : (
                    <Link
                      href={`/${item.workspace_detail?.slug ?? workspaceSlug}/profile/${actor.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {actorName}
                    </Link>
                  )}{" "}
                  {isComment ? t("web.commented") : <ActivityMessage activity={item} showIssue />}
                </p>
                <Tooltip label={`${renderFormattedDate(item.created_at)}, ${renderFormattedTime(item.created_at)}`}>
                  <time
                    dateTime={new Date(item.created_at).toISOString()}
                    className="shrink-0 text-right text-11 whitespace-nowrap text-tertiary"
                  >
                    {calculateTimeAgo(item.created_at)}
                  </time>
                </Tooltip>
              </div>
              {isComment && (
                <div className="issue-comments-section mt-2 ml-9 min-w-0 p-0">
                  <RichTextEditor
                    editable={false}
                    id={item.id}
                    initialValue={(item.new_value || item.old_value || "").toString()}
                    containerClassName="text-13 bg-transparent"
                    workspaceId={workspaceId}
                    workspaceSlug={workspaceSlug?.toString() ?? ""}
                    projectId={item.project}
                  />
                </div>
              )}
            </li>
          );
        })}
    </ul>
  );
});
