import { supportsBrowserNotifications } from "./client";
import { isEnabled, readState, writeState } from "./storage";

export function watchNotificationOnboarding(userId: string, onOpenChange: (open: boolean) => void) {
  if (!supportsBrowserNotifications()) return;
  // The old onboarding-shown key was set before rendering and cannot prove that a prompt was seen.
  const key = `onboarding-presented:${userId}`;
  let disposed = false;
  let suspended = false;
  let checking = false;
  let recheck = false;
  let done = false;
  let settlePresentation: ((presented: boolean) => void) | undefined;
  const isEligible = () =>
    !disposed && !suspended && document.visibilityState === "visible" && Notification.permission === "default";
  const finishPresentation = (presented: boolean) => {
    const settle = settlePresentation;
    settlePresentation = undefined;
    settle?.(presented);
  };
  const withdraw = () => {
    if (!settlePresentation) return;
    finishPresentation(false);
    onOpenChange(false);
  };

  const check = async () => {
    if (done || !isEligible()) return;
    if (checking) {
      recheck = true;
      return;
    }
    checking = true;
    try {
      await navigator.locks.request("plane-browser-notification-onboarding-v1", async () => {
        if (!isEligible()) return;
        done = (await readState<boolean>(key)) === true;
        if (done || !(await isEnabled(userId)) || !isEligible()) return;

        // Keep other tabs waiting until this one actually presents the dialog or withdraws.
        const presented = await new Promise<boolean>((resolve) => {
          settlePresentation = resolve;
          onOpenChange(true);
        });
        if (presented) {
          done = true;
          await writeState(key, true);
        }
      });
    } catch (error) {
      done = true; // Storage failure must not block the workspace or repeatedly interrupt it.
      if (!disposed) console.warn("Browser notification onboarding unavailable", error);
    } finally {
      checking = false;
      if (recheck) {
        recheck = false;
        void check();
      }
    }
  };
  const checkVisible = () => {
    if (isEligible()) void check();
    else withdraw();
  };
  const suspend = () => {
    suspended = true;
    withdraw();
  };
  const resume = () => {
    suspended = false;
    checkVisible();
  };
  document.addEventListener("visibilitychange", checkVisible);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  checkVisible();

  return {
    confirmPresentation() {
      if (isEligible()) finishPresentation(true);
      else withdraw();
    },
    dispose() {
      disposed = true;
      finishPresentation(false);
      document.removeEventListener("visibilitychange", checkVisible);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", resume);
    },
  };
}
