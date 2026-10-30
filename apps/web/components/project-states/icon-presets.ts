import type { TStateIcon } from "@plane/types";

export const STATE_ICON_PRESETS: (TStateIcon | null)[] = [
  null,
  "backlog",
  "unstarted",
  "started-25",
  "started-50",
  "started-75",
  "started-100",
  "completed",
  "cancelled",
  "queued",
  "paused",
  "blocked",
  "review",
  "planned",
  "ready",
  "active",
  "feedback",
  "testing",
  "verifying",
  "approval",
  "rework",
  "skipped",
  "archived",
];
export const stateIconLabel = (icon: TStateIcon | null) =>
  `web.state_icon_${icon?.replace("-", "_") ?? "auto"}` as const;
