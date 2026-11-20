import { useContext, useEffect } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { StoreContext } from "@/lib/store-context";
import { isEnabled } from "@/lib/browser-notifications/storage";
import {
  listenForNotificationNavigation,
  NOTIFICATION_PREFERENCE_EVENT,
  requestNotificationSync,
  supportsBrowserNotifications,
} from "@/lib/browser-notifications/client";

/** Tabs only wake a shared worker. Polling, deduplication and delivery happen there. */
export const BrowserNotificationProvider = observer(function BrowserNotificationProvider() {
  const store = useContext(StoreContext);
  const userId = store.user.data?.id;
  const workspace = store.router.workspaceSlug;
  const { t } = useTranslation();
  useEffect(() => {
    if (!userId || !supportsBrowserNotifications()) return;
    return listenForNotificationNavigation(
      () => store.user.data?.id,
      (url) => window.location.assign(url)
    );
  }, [store, userId]);
  useEffect(() => {
    if (!userId || !workspace || !supportsBrowserNotifications()) return;
    let disposed = false;
    let pending = false;
    let hidden = false;
    const wake = async () => {
      if (disposed || pending || hidden || !navigator.onLine || Notification.permission !== "granted") return;
      pending = true;
      try {
        if (!(await isEnabled(userId)) || disposed) return;
        await requestNotificationSync({
          userId,
          workspace,
          title: t("notification_preferences.browser.notification_title"),
          body: t("notification_preferences.browser.notification_body", { workspace }),
        });
      } catch (error) {
        if (!disposed) console.warn("Browser notification sync failed; retrying on next wake", error);
      } finally {
        pending = false;
      }
    };
    const onWake = () => {
      void wake();
    };
    const onHide = () => {
      hidden = true;
    };
    const onShow = () => {
      hidden = false;
      onWake();
    };
    const timer = setInterval(onWake, 15000);
    window.addEventListener("online", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    window.addEventListener(NOTIFICATION_PREFERENCE_EVENT, onWake);
    onWake();
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("online", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener(NOTIFICATION_PREFERENCE_EVENT, onWake);
    };
  }, [userId, workspace, t]);
  return null;
});
