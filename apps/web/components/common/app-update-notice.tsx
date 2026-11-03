import { useEffect, useState } from "react";
import { useTranslation } from "@plane/i18n";
import { Banner } from "@makeplane/propel/components/banner";
import { Button } from "@makeplane/propel/components/button";

declare const __PLANE_WEB_BUILD_ID__: string;
const checkInterval = 60_000;

export function AppUpdateNotice() {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (typeof __PLANE_WEB_BUILD_ID__ === "undefined") return;
    let stopped = false;
    let detected = false;
    let controller: AbortController | undefined;
    const check = async () => {
      if (stopped || detected || controller || document.visibilityState === "hidden" || !navigator.onLine) return;
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
        detected = true;
        setAvailable(true);
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
    };
  }, []);
  if (!available) return null;
  return (
    <div data-app-update-banner="" className="w-full shrink-0">
      <Banner
        placement="page"
        size="sm"
        variant="accent"
        icon={null}
        aria-live="polite"
        aria-atomic="true"
        description={
          <span>
            <span className="font-medium">{t("app_update.title")}</span>
            <span className="ml-2 hidden md:inline">{t("app_update.description")}</span>
          </span>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            stretch="auto"
            label={t("app_update.refresh")}
            onClick={() => window.location.reload()}
          />
        }
        dismissLabel={t("close")}
        onDismiss={() => setAvailable(false)}
      />
    </div>
  );
}
