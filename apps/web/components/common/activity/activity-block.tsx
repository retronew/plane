/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FC, ReactNode } from "react";
import { HierarchyOutline } from "@makeplane/propel/icons";
// types
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { TWorkspaceBaseActivity } from "@plane/types";
// ui
// helpers
import { renderFormattedTime, renderFormattedDate, calculateTimeAgo } from "@plane/utils";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";
// local components
import { User } from "./user";
import { ActivitySentence } from "./activity-sentence";

type TActivityBlockComponent = {
  icon?: FC<{ className?: string }>;
  activity: TWorkspaceBaseActivity;
  ends: "top" | "bottom" | undefined;
  children: ReactNode;
  customUserName?: string;
};

export function ActivityBlockComponent(props: TActivityBlockComponent) {
  const { icon: Icon, activity, ends, children, customUserName } = props;
  // hooks
  const { isMobile } = usePlatformOS();

  if (!activity) return <></>;
  return (
    <div
      className={`relative flex items-center gap-3 text-caption-sm-regular ${
        ends === "top" ? `pb-3` : ends === "bottom" ? `pt-3` : `py-3`
      }`}
    >
      <div className="z-[4] flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-subtle text-secondary shadow-raised-100">
        {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <HierarchyOutline className="h-4 w-4 shrink-0" />}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 text-secondary">
        <div className="min-w-0 flex-1 break-words">
          <User activity={activity} customUserName={customUserName} /> <ActivitySentence>{children}</ActivitySentence>
        </div>
        <div className="shrink-0">
          <Tooltip
            label={`${renderFormattedDate(activity.created_at)}, ${renderFormattedTime(activity.created_at)}`}
            disabled={isMobile}
          >
            <span className="cursor-help font-medium whitespace-nowrap text-tertiary">
              {calculateTimeAgo(activity.created_at)}
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
