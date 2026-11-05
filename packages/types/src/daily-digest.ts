import type { TNotificationChannel } from "./notification-preferences";

export const DAILY_DIGEST_MODULES = [
  "completed",
  "open",
  "overdue",
  "due_today",
  "due_soon",
  "newly_assigned",
] as const;
export type TDailyDigestModule = (typeof DAILY_DIGEST_MODULES)[number];
export type TDailyDigestSettings = {
  enabled: boolean;
  send_time: string;
  weekdays_only: boolean;
  channels: TNotificationChannel[];
  workspace_ids: string[];
  project_ids: string[];
  modules: TDailyDigestModule[];
  include_details: boolean;
  send_empty: boolean;
  due_soon_days: number;
  timezone: string;
};
export type TDailyDigestSettingsPatch = Partial<Omit<TDailyDigestSettings, "timezone">>;
export type TDailyDigestItem = {
  id: string;
  name: string;
  identifier: string;
  workspace_slug: string;
  project_id: string;
  target_date: string | null;
};
export type TDailyDigestSection = {
  key: TDailyDigestModule;
  count: number;
  items: TDailyDigestItem[];
};
export type TDailyDigestPreview = {
  period_start: string;
  period_end: string;
  timezone: string;
  sections: TDailyDigestSection[];
};
