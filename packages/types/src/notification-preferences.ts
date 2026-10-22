export const NOTIFICATION_CHANNELS = ["in_app", "email", "feishu"] as const;
export const NOTIFICATION_EVENTS = [
  "property_change",
  "state_change",
  "issue_completed",
  "comment",
  "mention",
  "due_reminder",
  "approval_requested",
  "intake_created",
] as const;
export type TNotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type TNotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
export type TNotificationScope = { workspace_id?: string | null; project_id?: string | null };
export type TNotificationPreferenceSource =
  | "channel_disabled"
  | "project"
  | "workspace"
  | "global"
  | "legacy"
  | "default";
export type TNotificationPreferences = {
  scope: TNotificationScope;
  channels: Record<TNotificationChannel, boolean>;
  override_scopes: Record<TNotificationChannel, boolean>;
  events: Record<TNotificationChannel, Record<TNotificationEvent, boolean | null>>;
  effective: Record<
    TNotificationChannel,
    Record<TNotificationEvent, { enabled: boolean; source: TNotificationPreferenceSource }>
  >;
};
export type TNotificationPreferencesPatch = {
  channels?: Partial<TNotificationPreferences["channels"]>;
  override_scopes?: Partial<TNotificationPreferences["override_scopes"]>;
  events?: Partial<Record<TNotificationChannel, Partial<Record<TNotificationEvent, boolean | null>>>>;
};
export type TFeishuBindingStatus = {
  enabled: boolean;
  last_delivery: {
    status: "pending" | "retry" | "sent" | "failed" | "cancelled";
    error: string;
    created_at: string;
    sent_at: string | null;
  } | null;
  binding: { display_name: string; created_at: string; app_id: string } | null;
};
