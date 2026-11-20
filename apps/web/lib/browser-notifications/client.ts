// Vite synthesizes this default export from the worker entry.
// oxlint-disable-next-line import/default
import workerUrl from "./notification.worker?worker&url";
import { getNotificationTarget, NOTIFICATION_OPEN_MESSAGE } from "./navigation";

export const NOTIFICATION_PREFERENCE_EVENT = "plane-browser-notification-preference";

export function listenForNotificationNavigation(
  getUserId: () => string | undefined,
  navigate: (url: string) => void
): () => void {
  const serviceWorker = navigator.serviceWorker;
  let disposed = false;
  const onMessage = async (event: MessageEvent) => {
    const { type, url, userId, expiresAt } = event.data ?? {};
    const port = event.ports[0];
    if (type !== NOTIFICATION_OPEN_MESSAGE || !port) return;
    const target = getNotificationTarget(url, window.location.origin);
    const isCurrent = () =>
      !disposed &&
      typeof userId === "string" &&
      userId === getUserId() &&
      typeof expiresAt === "number" &&
      expiresAt > Date.now();
    let accepted = false;
    try {
      if (target && event.origin === window.location.origin && isCurrent()) {
        const registration = await serviceWorker.getRegistration(new URL(workerUrl, window.location.href).href);
        accepted = !!event.source && event.source === registration?.active && isCurrent();
      }
    } catch {
      accepted = false;
    }
    port.postMessage({ ok: accepted });
    port.close();
    if (accepted && target) navigate(target.href);
  };
  serviceWorker.addEventListener("message", onMessage);
  return () => {
    disposed = true;
    serviceWorker.removeEventListener("message", onMessage);
  };
}
export function supportsBrowserNotifications(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "locks" in navigator &&
    "indexedDB" in window
  );
}

let registrationPromise: Promise<ServiceWorkerRegistration> | undefined;
async function registerWorker(): Promise<ServiceWorkerRegistration> {
  registrationPromise ??= (async () => {
    // Use the script's own scope, leaving any existing root PWA worker untouched.
    const registration = await navigator.serviceWorker.register(workerUrl, { type: "module", updateViaCache: "none" });
    if (registration.active) return registration;
    const candidate = registration.installing ?? registration.waiting;
    if (!candidate) throw new Error("Notification worker unavailable");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error("Notification worker activation timed out")), 15000);
      const finish = (error?: Error) => {
        clearTimeout(timer);
        candidate.removeEventListener("statechange", check);
        if (error) reject(error);
        else resolve();
      };
      const check = () => {
        if (candidate.state === "activated") finish();
        else if (candidate.state === "redundant") finish(new Error("Notification worker activation failed"));
      };
      candidate.addEventListener("statechange", check);
      check();
    });
    return registration;
  })().catch((error: unknown) => {
    registrationPromise = undefined;
    throw error;
  });
  return registrationPromise;
}

export async function requestNotificationSync(request: {
  userId: string;
  workspace: string;
  title: string;
  body: string;
  test?: boolean;
}): Promise<void> {
  if (!supportsBrowserNotifications() || Notification.permission !== "granted")
    throw new Error("Notifications unavailable");
  const registration = await registerWorker();
  const active = registration.active;
  if (!active) throw new Error("Notification worker not active");
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error("Notification delivery timed out")), 60000);
    channel.port1.addEventListener("message", (event: MessageEvent<{ ok: boolean }>) =>
      finish(event.data?.ok ? undefined : new Error("Notification delivery failed"))
    );
    channel.port1.addEventListener("messageerror", () => finish(new Error("Invalid notification response")));
    channel.port1.start();
    active.postMessage({ ...request, type: "plane-notifications" }, [channel.port2]);
  });
}
