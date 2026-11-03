import { useEffect } from "react";
import { useTranslation } from "@plane/i18n";
import { toastManager } from "@plane/blocks/toast";

declare const __PLANE_WEB_BUILD_ID__: string;
const checkInterval = 60_000;

export function AppUpdateNotice() {
  const { t } = useTranslation();
  useEffect(() => {
    if (typeof __PLANE_WEB_BUILD_ID__ === "undefined") return;
    let stopped = false;
    let toastId: string | undefined;
    let controller: AbortController | undefined;
    const check = async () => {
      if (stopped || toastId || controller || document.visibilityState === "hidden" || !navigator.onLine) return;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (
          stopped ||
          !data ||
          typeof data !== "object" ||
          !("buildId" in data) ||
          typeof data.buildId !== "string" ||
          !data.buildId ||
          data.buildId === __PLANE_WEB_BUILD_ID__
        )
          return;
        toastId = toastManager.add({
          id: "app-update-available",
          timeout: 0,
          title: t("app_update.title"),
          description: t("app_update.description"),
          data: {
            variant: "info",
            primaryAction: { label: t("app_update.refresh"), onClick: () => window.location.reload() },
          },
        });
      } catch {
        // Offline, old deployments and transient proxy failures must not interrupt current work.
      } finally {
        window.clearTimeout(timeout);
        controller = undefined;
      }
    };
    void check();
    const onResume = () => void check();
    const timer = window.setInterval(onResume, checkInterval);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
      document.removeEventListener("visibilitychange", onResume);
      if (toastId) toastManager.close(toastId);
    };
  }, [t]);
  return null;
}
