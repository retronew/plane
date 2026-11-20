import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@plane/i18n";
import { useUser } from "@/hooks/store/user";
import { getPreference, preferenceKey, writeState } from "@/lib/browser-notifications/storage";
import {
  NOTIFICATION_PREFERENCE_EVENT,
  requestNotificationSync,
  supportsBrowserNotifications,
} from "@/lib/browser-notifications/client";
import {
  broadcastNotificationPreferenceChange,
  requestBrowserNotificationPermission,
} from "@/lib/browser-notifications/preference-events";

function subscribePreferenceChanges(refresh: () => void) {
  const channel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(NOTIFICATION_PREFERENCE_EVENT) : undefined;
  if (channel) channel.addEventListener("message", refresh);
  window.addEventListener(NOTIFICATION_PREFERENCE_EVENT, refresh);
  window.addEventListener("focus", refresh);
  return () => {
    if (channel) {
      channel.removeEventListener("message", refresh);
      channel.close();
    }
    window.removeEventListener(NOTIFICATION_PREFERENCE_EVENT, refresh);
    window.removeEventListener("focus", refresh);
  };
}

export function useBrowserNotifications() {
  const { data: user } = useUser();
  const userId = user?.id;
  const identity = useRef(userId);
  useEffect(() => {
    identity.current = userId;
    return () => {
      identity.current = undefined;
    };
  }, [userId]);
  const { t } = useTranslation();
  const [enabled, updateEnabled] = useState(true);
  const [permission, updatePermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = supportsBrowserNotifications();

  useEffect(() => {
    let disposed = false;
    let version = 0;
    let initial = true;
    const refresh = () => {
      const requestVersion = ++version;
      void (async () => {
        try {
          const preference =
            userId && supported ? await getPreference(userId) : await Promise.resolve({ enabled: true });
          if (disposed || version !== requestVersion) return;
          updatePermission(supported ? Notification.permission : "unsupported");
          updateEnabled(preference.enabled);
          if (initial) {
            initial = false;
            setError(false);
            setBusy(false);
          }
        } catch {
          if (!disposed) setError(true);
        }
      })();
    };
    const unsubscribe = subscribePreferenceChanges(refresh);
    refresh();
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [userId, supported]);

  const setEnabled = useCallback(
    (value: boolean) => {
      if (!userId || !supported) return;
      setBusy(true);
      setError(false);
      void (async () => {
        try {
          await writeState(preferenceKey(userId), { enabled: value, revision: crypto.randomUUID() });
          broadcastNotificationPreferenceChange();
          if (identity.current === userId) updateEnabled(value);
        } catch {
          if (identity.current === userId) setError(true);
        } finally {
          if (identity.current === userId) setBusy(false);
        }
      })();
    },
    [userId, supported]
  );

  const requestPermission = useCallback(async () => {
    if (!supported || Notification.permission !== "default") return;
    setBusy(true);
    setError(false);
    try {
      const result = await requestBrowserNotificationPermission();
      if (identity.current === userId) updatePermission(result);
    } catch {
      if (identity.current === userId) setError(true);
    } finally {
      // Reset is in finally; the identity guard prevents an old account's request clearing a new account's busy state.
      // eslint-disable-next-line react-doctor/no-loading-flag-reset-outside-finally
      if (identity.current === userId) setBusy(false);
    }
  }, [supported, userId]);

  const sendTest = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(false);
    try {
      await requestNotificationSync({
        userId,
        workspace: "",
        test: true,
        title: t("notification_preferences.browser.test_title"),
        body: t("notification_preferences.browser.test_body"),
      });
    } catch {
      if (identity.current === userId) setError(true);
    } finally {
      // Reset is in finally; the identity guard prevents an old account's request clearing a new account's busy state.
      // eslint-disable-next-line react-doctor/no-loading-flag-reset-outside-finally
      if (identity.current === userId) setBusy(false);
    }
  }, [userId, t]);

  return { enabled, supported, permission, error, busy, setEnabled, requestPermission, sendTest };
}
