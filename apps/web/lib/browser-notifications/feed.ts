/* Sequential cursor pages are required to preserve the notification watermark. */
/* oxlint-disable no-await-in-loop */
import type { TNotification, TNotificationPaginatedInfo } from "@plane/types";

export type Checkpoint = { time: number; ids: string[] };
export type FetchPage = (mentioned: boolean, cursor?: string) => Promise<TNotificationPaginatedInfo>;
const timestamp = (notification: TNotification) => Date.parse(notification.created_at ?? "");

export function advanceCheckpoint(previous: Checkpoint, notification: TNotification): Checkpoint {
  const time = timestamp(notification);
  if (!Number.isFinite(time) || time < previous.time) return previous;
  return { time, ids: time === previous.time ? [...new Set([...previous.ids, notification.id])] : [notification.id] };
}

/** Read both streams independently of inbox UI filters. Never commit a partial pagination result. */
export async function collectNotifications(
  fetchPage: FetchPage,
  mentioned: boolean,
  checkpoint?: Checkpoint
): Promise<{ checkpoint: Checkpoint; notifications: TNotification[] }> {
  let cursor: string | undefined;
  const cursors = new Set<string>();
  const checkpointIds = new Set(checkpoint?.ids);
  const notifications = new Map<string, TNotification>();
  let next = checkpoint ?? { time: 0, ids: [] };
  let baselineTime: number | undefined;
  for (let page = 0; page < 100; page++) {
    const data = await fetchPage(mentioned, cursor);
    if (!Array.isArray(data.results)) throw new Error("Invalid notification response");
    let reachedBoundary = false;
    for (const notification of data.results) {
      const time = timestamp(notification);
      if (!Number.isFinite(time)) throw new Error("Invalid notification timestamp");
      baselineTime ??= time;
      const boundary = checkpoint?.time ?? baselineTime;
      if (time < boundary) {
        reachedBoundary = true;
        break;
      }
      next = advanceCheckpoint(next, notification);
      if (checkpoint && (time > checkpoint.time || !checkpointIds.has(notification.id))) {
        notifications.set(notification.id, notification);
      }
    }
    if (reachedBoundary || !data.next_page_results) {
      return {
        checkpoint: next,
        // Sorting a fresh array supports browsers predating Array.prototype.toSorted.
        // oxlint-disable-next-line unicorn/no-array-sort
        notifications: [...notifications.values()].sort(
          (a, b) => timestamp(a) - timestamp(b) || a.id.localeCompare(b.id)
        ),
      };
    }
    if (!data.next_cursor || cursors.has(data.next_cursor)) throw new Error("Invalid notification cursor");
    cursors.add(data.next_cursor);
    cursor = data.next_cursor;
  }
  throw new Error("Notification pagination limit exceeded");
}

export function notificationPath(notification: TNotification, workspace: string): string {
  const root = `/${encodeURIComponent(workspace)}`;
  const issue = notification.data?.issue?.id ?? notification.data?.issue_id ?? notification.entity_identifier;
  const project = notification.project ?? notification.data?.project_id;
  if (notification.entity_name === "issue" && issue && project) {
    if (notification.is_inbox_issue) {
      return `${root}/projects/${encodeURIComponent(project)}/intake?inboxIssueId=${encodeURIComponent(issue)}`;
    }
    return `${root}/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue)}/`;
  }
  return `${root}/notifications/`;
}

export function shouldNotify(notification: TNotification, userId: string): boolean {
  return (
    notification.receiver === userId && !notification.read_at && !notification.archived_at && !notification.snoozed_till
  );
}
