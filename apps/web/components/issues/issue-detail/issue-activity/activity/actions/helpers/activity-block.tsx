/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext, type ReactNode } from "react";
import { ActivityDisplayContext, IntakeActivityContext } from "../../../intake-activity-context";
import { Avatar } from "@makeplane/propel/components/avatar";
import { cn, getFileURL } from "@plane/utils";
import { useMember } from "@/hooks/store/use-member";

import { HierarchyOutline } from "@makeplane/propel/icons";
// plane imports
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { renderFormattedTime, renderFormattedDate, calculateTimeAgo } from "@plane/utils";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { IssueUser } from "./issue-user";
import { ActivitySentence } from "@/components/common/activity/activity-sentence";
import { IssueCreatorDisplay } from "./issue-creator";

export function IntakeActivityActor({ activityId }: { activityId: string }) {
  const {
    activity: { getActivityById },
  } = useIssueDetail();
  const { getUserDetails } = useMember();
  const activity = getActivityById(activityId);
  const actor = activity?.actor_detail;
  const member = actor?.id ? getUserDetails(actor.id) : undefined;
  const name = member?.display_name ?? actor?.display_name;
  if (!activity || !actor?.id || !name || actor.is_bot) return null;
  return (
    <Tooltip label={name}>
      <a
        className="mr-1.5 inline-flex align-middle"
        aria-label={name}
        href={`/${activity.workspace_detail?.slug}/profile/${actor.id}`}
      >
        <Avatar
          size="xs"
          alt={name}
          fallback={name[0]?.toUpperCase()}
          src={getFileURL(member?.avatar_url ?? actor.avatar_url ?? "")}
        />
      </a>
    </Tooltip>
  );
}

type TIssueActivityBlockComponent = {
  icon?: ReactNode;
  activityId: string;
  ends: "top" | "bottom" | undefined;
  children: ReactNode;
  customUserName?: string;
};

function ActivityTimestamp({ createdAt, isMobile }: { createdAt: string; isMobile: boolean }) {
  return (
    <div className={cn("shrink-0", "text-11")}>
      <Tooltip label={`${renderFormattedDate(createdAt)}, ${renderFormattedTime(createdAt)}`} disabled={isMobile}>
        <span className="whitespace-nowrap text-tertiary"> {calculateTimeAgo(createdAt)}</span>
      </Tooltip>
    </div>
  );
}

export function IssueActivityBlockComponent(props: TIssueActivityBlockComponent) {
  const { icon, activityId, ends, children, customUserName } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);
  const isIntakeIssue = useContext(IntakeActivityContext);
  const detailDisplay = useContext(ActivityDisplayContext) || isIntakeIssue;
  const { isMobile } = usePlatformOS();
  if (!activity) return <></>;
  return (
    <div
      className={cn(
        "relative flex items-center gap-3",
        "text-caption-sm-regular",
        ends === "top" ? "pb-2" : ends === "bottom" ? "pt-2" : "py-2"
      )}
    >
      <div className="absolute top-0 bottom-0 left-[13px] w-px bg-layer-3" aria-hidden />
      <div className="z-[4] flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-subtle bg-layer-2 text-secondary shadow-raised-100 [&_svg]:size-4">
        {icon ? icon : <HierarchyOutline className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1 break-words text-secondary">
        {detailDisplay && !customUserName && <IntakeActivityActor activityId={activityId} />}
        <Tooltip
          label={customUserName ?? activity.actor_detail?.display_name ?? ""}
          disabled={!detailDisplay || !activity.actor_detail?.display_name}
        >
          <span>
            {!activity?.field && activity?.verb === "created" ? (
              <IssueCreatorDisplay activityId={activityId} customUserName={customUserName} />
            ) : (
              <IssueUser activityId={activityId} customUserName={customUserName} />
            )}
          </span>
        </Tooltip>
        <ActivitySentence> {children} </ActivitySentence>
      </div>
      <ActivityTimestamp createdAt={activity.created_at} isMobile={isMobile} />
    </div>
  );
}
