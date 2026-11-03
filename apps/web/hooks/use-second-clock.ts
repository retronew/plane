import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function notify() {
  if (document.visibilityState !== "hidden") listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(notify, 1_000);
    window.addEventListener("focus", notify);
    document.addEventListener("visibilitychange", notify);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
      window.removeEventListener("focus", notify);
      document.removeEventListener("visibilitychange", notify);
    }
  };
}

const getSnapshot = () => Math.floor(Date.now() / 1_000) * 1_000;
const getServerSnapshot = () => 0;

/** All visible status-duration chips share one clock; hidden tabs do not rerender each second. */
export function useSecondClock() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
