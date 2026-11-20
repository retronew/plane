export const NOTIFICATION_OPEN_MESSAGE = "plane-browser-notification-open";

export function getNotificationTarget(value: unknown, origin: string): URL | undefined {
  if (typeof value !== "string" || !value) return;
  try {
    const target = new URL(value, origin);
    if (
      target.origin === origin &&
      (target.protocol === "https:" || target.protocol === "http:") &&
      !target.username &&
      !target.password
    )
      return target;
  } catch {
    return;
  }
}
