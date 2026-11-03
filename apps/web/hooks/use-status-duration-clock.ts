import { useCallback, useSyncExternalStore } from "react";
import { getNextDurationChange } from "@/components/issues/issue-layouts/properties/status-duration";

const subscribers = new Map<() => void, { since: number; next: number }>();
let timer: ReturnType<typeof setTimeout> | undefined;
let currentTime = Date.now();

function schedule() {
  clearTimeout(timer);
  timer = undefined;
  if (!subscribers.size || document.visibilityState === "hidden") return;
  const next = Math.min(...Array.from(subscribers.values(), (entry) => entry.next));
  timer = setTimeout(tick, Math.min(2_147_483_647, Math.max(1, next - Date.now())));
}

function tick() {
  const now = Date.now();
  currentTime = now;
  subscribers.forEach((entry, notify) => {
    if (entry.next <= now) {
      entry.next = getNextDurationChange(entry.since, now);
      notify();
    }
  });
  schedule();
}

function resume() {
  currentTime = Date.now();
  subscribers.forEach((entry, notify) => {
    entry.next = getNextDurationChange(entry.since, Date.now());
    notify();
  });
  schedule();
}

function subscribe(notify: () => void, since: number | undefined) {
  if (since === undefined) return () => {};
  currentTime = Date.now();
  subscribers.set(notify, { since, next: getNextDurationChange(since, Date.now()) });
  if (subscribers.size === 1) {
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
  }
  schedule();
  return () => {
    subscribers.delete(notify);
    if (!subscribers.size) {
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    }
    schedule();
  };
}

const getSnapshot = () => currentTime;
const getServerSnapshot = () => 0;

/** One shared timeout wakes only at the next visible duration boundary. */
export function useStatusDurationClock(since: number | undefined) {
  const listen = useCallback((notify: () => void) => subscribe(notify, since), [since]);
  return useSyncExternalStore(listen, getSnapshot, getServerSnapshot);
}
