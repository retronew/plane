import { NOTIFICATION_PREFERENCE_EVENT } from "./client";

export function broadcastNotificationPreferenceChange() {
  window.dispatchEvent(new Event(NOTIFICATION_PREFERENCE_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(NOTIFICATION_PREFERENCE_EVENT);
    // BroadcastChannel is same-origin by definition; it has no targetOrigin parameter.
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    channel.postMessage(null);
    channel.close();
  }
}

/** Call directly from the user's click, before awaiting any other work. */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  const permission = Notification.permission;
  if (permission !== "default") return permission;
  const result = await Notification.requestPermission();
  broadcastNotificationPreferenceChange();
  return result;
}
