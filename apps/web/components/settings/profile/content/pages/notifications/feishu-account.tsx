import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { NotificationPreferencesService } from "@plane/services";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { useAppRouter } from "@/hooks/use-app-router";

const service = new NotificationPreferencesService();
export function FeishuAccount() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const router = useAppRouter();
  const { data, error, mutate } = useSWR("FEISHU_BINDING_STATUS", () => service.feishuStatus(), {
    refreshInterval: (status) => (["pending", "retry"].includes(status?.last_delivery?.status ?? "") ? 5000 : 0),
  });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState<
    "feishu_queued" | "feishu_error" | "feishu_connected" | "feishu_identity_in_use" | null
  >(() => {
    const result = params.get("feishu");
    if (result === "identity_in_use") return "feishu_identity_in_use";
    return result ? (result === "connected" ? "feishu_connected" : "feishu_error") : null;
  });
  useEffect(() => {
    const result = params.get("feishu");
    if (!result) return;
    void mutate();
    const url = new URL(window.location.href);
    url.searchParams.delete("feishu");
    router.replace(`${url.pathname}${url.search}${url.hash}`);
  }, [params, router, mutate]);
  async function act(action: "link" | "unlink" | "test") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      if (action === "link") {
        const { authorization_url } = await service.authorizeFeishu();
        const target = new URL(authorization_url);
        if (target.protocol !== "https:") throw new Error("Invalid authorization URL");
        window.location.assign(target.href);
      } else if (action === "unlink") {
        await service.unlinkFeishu();
        await mutate();
      } else {
        await service.testFeishu();
        setMessage("feishu_queued");
        await mutate();
      }
    } catch {
      setMessage("feishu_error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-2" aria-busy={busy}>
      <SettingsBoxedControlItem
        title={t("notification_preferences.channels.feishu")}
        description={t("notification_preferences.feishu_description")}
        control={
          data && (
            <div className="flex flex-wrap gap-2">
              {data.binding ? (
                <>
                  <Button
                    stretch="auto"
                    variant="secondary"
                    size="sm"
                    label={t("notification_preferences.feishu_test")}
                    disabled={busy || !data.enabled}
                    onClick={() => void act("test")}
                  />
                  <Button
                    stretch="auto"
                    variant="ghost"
                    size="sm"
                    label={t("notification_preferences.feishu_unlink")}
                    disabled={busy}
                    onClick={() => void act("unlink")}
                  />
                </>
              ) : (
                <Button
                  stretch="auto"
                  variant="primary"
                  size="sm"
                  label={t("notification_preferences.feishu_link")}
                  disabled={busy || !data.enabled}
                  onClick={() => void act("link")}
                />
              )}
            </div>
          )
        }
      />
      {error ? (
        <div role="alert" className="text-13">
          {t("notification_preferences.feishu_error")}
          <Button
            stretch="auto"
            variant="secondary"
            size="sm"
            label={t("notification_preferences.retry")}
            onClick={() => void mutate()}
          />
        </div>
      ) : (
        <p className="text-13 text-secondary">
          {!data
            ? t("notification_preferences.loading")
            : data.binding
              ? t("notification_preferences.feishu_linked", { name: data.binding.display_name })
              : t("notification_preferences.feishu_unlinked")}
        </p>
      )}
      {data && !data.enabled && (
        <p className="text-13 text-secondary">{t("notification_preferences.feishu_disabled")}</p>
      )}
      {data?.last_delivery && (
        <output className="block text-13 text-secondary">
          {t(`notification_preferences.delivery.${data.last_delivery.status}`)}
        </output>
      )}
      {message && (
        <p
          role={message === "feishu_error" || message === "feishu_identity_in_use" ? "alert" : "status"}
          className="text-13"
        >
          {t(`notification_preferences.${message}`)}
        </p>
      )}
    </section>
  );
}
