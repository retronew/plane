import type { TAnalyticsDetailTab } from "@plane/types";

export const DETAIL_COLUMNS: Record<TAnalyticsDetailTab, string[]> = {
  projects: [
    "name",
    "members",
    "epics",
    "work_items",
    "completed",
    "cancelled",
    "cycles",
    "modules",
    "pages",
    "views",
    "intake",
    "completion",
  ],
  users: ["name", "started", "unstarted", "completed", "cancelled"],
  cycles: ["name", "project", "lead", "start_date", "end_date", "work_items", "completed", "cancelled", "completion"],
  modules: [
    "name",
    "lead",
    "project",
    "start_date",
    "end_date",
    "status",
    "work_items",
    "completed",
    "cancelled",
    "completion",
  ],
  intake: ["name", "pending", "snoozed", "accepted", "rejected", "duplicate", "total"],
};
