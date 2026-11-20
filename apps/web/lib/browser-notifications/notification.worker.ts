// Claims must commit in delivery order before each external side effect.
/* oxlint-disable no-await-in-loop */
import type { TNotification, TNotificationPaginatedInfo } from "@plane/types";
import { advanceCheckpoint, collectNotifications, notificationPath, shouldNotify, type Checkpoint } from "./feed";
import { getNotificationTarget, NOTIFICATION_OPEN_MESSAGE } from "./navigation";
import { getPreference, readState, writeState } from "./storage";

// This worker has no fetch handler and never caches or controls application requests.
type Client = {
  id: string;
  url: string;
  focus(): Promise<Client>;
  postMessage(data: unknown, transfer: Transferable[]): void;
};
type WorkerEvent = { waitUntil(promise: Promise<unknown>): void };
type MessageEvent = WorkerEvent & { data: NotificationRequest; source: Client | null; ports: MessagePort[] };
type ClickEvent = WorkerEvent & { notification: Notification & { data: { userId: string; url: string } } };
type NotificationRequest = {
  type: "plane-notifications";
  userId: string;
  workspace: string;
  title: string;
  body: string;
  test?: boolean;
};
const worker = globalThis as unknown as {
  location: Location;
  navigator: { locks: LockManager };
  registration: ServiceWorkerRegistration;
  clients: {
    get(id: string): Promise<Client | undefined>;
    matchAll(options: object): Promise<Client[]>;
    openWindow(url: string): Promise<Client | null>;
  };
  skipWaiting(): Promise<void>;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  addEventListener(type: "install", listener: (event: WorkerEvent) => void): void;
  addEventListener(type: "notificationclick", listener: (event: ClickEvent) => void): void;
};
// Avoid the constants barrel: it also pulls UI modules into a worker without a DOM.
const apiBaseUrl = (process.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const requestApi = (path: string) =>
  fetch(`${apiBaseUrl}${path}`, { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10000) });
async function getJson<T>(path: string): Promise<T> {
  const response = await requestApi(path);
  if (!response.ok) throw new Error(`Notification request failed: ${response.status}`);
  return response.json() as Promise<T>;
}
const currentUser = async () => (await getJson<{ id: string }>("/api/users/me/")).id;
const POLL_INTERVAL = 30000;
async function showBusinessNotification(
  notification: TNotification,
  workspace: string,
  copy: { title: string; body: string }
) {
  const name = notification.entity_name === "issue" ? notification.data?.issue?.name : undefined;
  const title = (typeof name === "string" && name.trim()) || copy.title;
  await worker.registration.showNotification(title, {
    body: copy.body,
    tag: `plane:${notification.receiver}:${notification.id}`,
    icon: "/favicon.ico",
    data: { userId: notification.receiver, url: notificationPath(notification, workspace) },
  });
}

function requestClientNavigation(client: Client, userId: string, url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = 1500;
    const finish = (accepted: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(accepted);
    };
    const timer = setTimeout(() => finish(false), timeout);
    channel.port1.addEventListener("message", (event) => finish(event.data?.ok === true), { once: true });
    channel.port1.addEventListener("messageerror", () => finish(false), { once: true });
    channel.port1.start();
    try {
      client.postMessage({ type: NOTIFICATION_OPEN_MESSAGE, userId, url, expiresAt: Date.now() + timeout }, [
        channel.port2,
      ]);
    } catch {
      channel.port2.close();
      finish(false);
    }
  });
}

async function handle(request: NotificationRequest, clientId: string): Promise<void> {
  await worker.navigator.locks.request("plane-browser-notifications-delivery-v1", async () => {
    const [client, preference] = await Promise.all([worker.clients.get(clientId), getPreference(request.userId)]);
    const matchesWorkspace = (candidate: Client | undefined) =>
      candidate &&
      new URL(candidate.url).origin === worker.location.origin &&
      (request.test || new URL(candidate.url).pathname.startsWith(`/${encodeURIComponent(request.workspace)}/`));
    if (!matchesWorkspace(client) || !preference.enabled || Notification.permission !== "granted") return;
    const scope = JSON.stringify([request.userId, request.workspace, preference.revision]);
    const lastPoll = await readState<number>(`poll:${scope}`);
    if (!request.test && lastPoll && Date.now() - lastPoll < POLL_INTERVAL) return;
    if ((await currentUser()) !== request.userId) return;
    const stillAllowed = async () => {
      const current = await getPreference(request.userId);
      return (
        Notification.permission === "granted" &&
        current.enabled &&
        current.revision === preference.revision &&
        Boolean(matchesWorkspace(await worker.clients.get(clientId))) &&
        (await currentUser()) === request.userId
      );
    };
    if (request.test) {
      if (!(await stillAllowed())) return;
      await worker.registration.showNotification(request.title, {
        body: request.body,
        tag: `plane-test:${request.userId}`,
        data: { userId: request.userId, url: "/" },
      });
      return;
    }
    for (const mentioned of [false, true]) {
      const key = `checkpoint:${scope}:${mentioned}`;
      let checkpoint = await readState<Checkpoint>(key);
      const result = await collectNotifications(
        async (isMentioned, cursor) => {
          const params = new URLSearchParams({
            browser_feed: "true",
            order_by: "-created_at",
            per_page: "100",
            mentioned: String(isMentioned),
          });
          if (cursor) params.set("cursor", cursor);
          return getJson<TNotificationPaginatedInfo>(
            `/api/workspaces/${encodeURIComponent(request.workspace)}/users/notifications/?${params}`
          );
        },
        mentioned,
        checkpoint
      );
      for (const notification of result.notifications) {
        if (!(await stillAllowed())) return;
        // Persist the claim BEFORE the OS side effect: at-most-once, even across worker termination.
        // A crash between these steps can lose an alert; the original remains in the inbox.
        checkpoint = advanceCheckpoint(checkpoint ?? { time: 0, ids: [] }, notification);
        await writeState(key, checkpoint);
        if (shouldNotify(notification, request.userId))
          await showBusinessNotification(notification, request.workspace, request);
      }
      if (!(await stillAllowed())) return;
      await writeState(key, result.checkpoint);
    }
    await writeState(`poll:${scope}`, Date.now());
  });
}

worker.addEventListener("install", (event) => event.waitUntil(worker.skipWaiting()));
worker.addEventListener("message", (event) => {
  const request = event.data;
  if (request?.type !== "plane-notifications" || !event.source?.id || !event.ports[0]) return;
  if (
    typeof request.userId !== "string" ||
    typeof request.workspace !== "string" ||
    typeof request.title !== "string" ||
    typeof request.body !== "string"
  )
    return;
  event.waitUntil(
    handle(request, event.source.id).then(
      () => event.ports[0].postMessage({ ok: true }),
      (error: unknown) => {
        console.error("Browser notifications failed", error);
        event.ports[0].postMessage({ ok: false });
      }
    )
  );
});
worker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const { userId, url } = event.notification.data ?? {};
      const target = getNotificationTarget(url, worker.location.origin);
      if (!userId || !target || (await currentUser()) !== userId) return;
      const clients = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
      const sameOrigin = clients.filter((candidate) => new URL(candidate.url).origin === target.origin);
      const workspace = target.pathname.split("/")[1];
      const client =
        sameOrigin.find((candidate) => candidate.url === target.href) ??
        sameOrigin.find((candidate) => new URL(candidate.url).pathname.split("/")[1] === workspace) ??
        sameOrigin[0];
      if (client) {
        const focused = await client.focus().catch(() => null);
        if (focused && (focused.url === target.href || (await requestClientNavigation(focused, userId, target.href))))
          return;
        if ((await currentUser()) !== userId) return;
      }
      await worker.clients.openWindow(target.href);
    })().catch((error: unknown) => console.error("Notification navigation failed", error))
  );
});
