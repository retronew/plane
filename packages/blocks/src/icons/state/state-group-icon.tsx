/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import {
  Clock3,
  CirclePause,
  CircleAlert,
  CircleHelp,
  CalendarClock,
  CircleArrowRight,
  Play,
  MessageCircle,
  FlaskConical,
  ShieldCheck,
  Stamp,
  RotateCcw,
  CircleMinus,
  Archive,
} from "lucide-react";

import { BacklogGroupIcon } from "./backlog-group-icon";
import { CancelledGroupIcon } from "./cancelled-group-icon";
import { CompletedGroupIcon } from "./completed-group-icon";
import type { StateGroup, StateIconSize } from "./helper";
import { getStateIconSize, STATE_GROUP_COLORS } from "./helper";
import { StartedGroupIcon } from "./started-group-icon";
import { UnstartedGroupIcon } from "./unstarted-group-icon";

export type StateGroupIconProps = {
  className?: string;
  color?: string;
  icon?: string | null;
  percentage?: number;
  stateGroup: StateGroup;
  size?: StateIconSize;
};

/** @deprecated Use StateGroupIconProps instead. */
export type IStateGroupIcon = StateGroupIconProps;

const iconComponents = {
  backlog: BacklogGroupIcon,
  cancelled: CancelledGroupIcon,
  completed: CompletedGroupIcon,
  started: StartedGroupIcon,
  unstarted: UnstartedGroupIcon,
};

const workflowIcons = {
  queued: Clock3,
  paused: CirclePause,
  blocked: CircleAlert,
  review: CircleHelp,
  planned: CalendarClock,
  ready: CircleArrowRight,
  active: Play,
  feedback: MessageCircle,
  testing: FlaskConical,
  verifying: ShieldCheck,
  approval: Stamp,
  rework: RotateCcw,
  skipped: CircleMinus,
  archived: Archive,
};

export function StateGroupIcon({
  className = "",
  color,
  percentage,
  icon,
  stateGroup,
  size = "sm",
}: StateGroupIconProps) {
  const progress = icon?.match(/^started-(25|50|75|100)$/);
  const group = progress ? "started" : icon && Object.hasOwn(iconComponents, icon) ? (icon as StateGroup) : stateGroup;
  const resolvedGroup = Object.hasOwn(iconComponents, group) ? group : "unstarted";
  const StateIconComponent = iconComponents[resolvedGroup];
  const iconSize = getStateIconSize(size);
  if (icon && Object.hasOwn(workflowIcons, icon)) {
    const WorkflowIcon = workflowIcons[icon as keyof typeof workflowIcons];
    return (
      <WorkflowIcon
        width={iconSize}
        height={iconSize}
        color={color?.trim() || STATE_GROUP_COLORS[resolvedGroup]}
        className={`shrink-0 ${className}`}
      />
    );
  }

  return (
    <StateIconComponent
      height={iconSize}
      width={iconSize}
      color={color?.trim() || STATE_GROUP_COLORS[resolvedGroup]}
      className={`shrink-0 ${className}`}
      percentage={progress ? Number(progress[1]) : percentage}
    />
  );
}
