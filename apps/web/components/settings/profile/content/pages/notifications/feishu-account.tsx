import { useRef, useState } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { NotificationPreferencesService } from "@plane/services";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";

const service = new NotificationPreferencesService();
export function FeishuAccount() {
  const { t } = useTranslation();
  const { data, error, mutate } = useSWR("FEISHU_BINDING_STATUS", () => service.feishuStatus(), {
    refreshInterval: (status) => (["pending", "retry"].includes(status?.last_delivery?.status ?? "") ? 5000 : 0),
  });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState<"feishu_queued" | "feishu_error" | null>(null);
  async function sendTest() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await service.testFeishu();
      setMessage("feishu_queued");
      await mutate();
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
          data?.binding && (
            <Button
              stretch="auto"
              variant="secondary"
              size="sm"
              label={t("notification_preferences.feishu_test")}
              disabled={busy || !data.enabled}
              onClick={() => void sendTest()}
            />
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
        <p role={message === "feishu_error" ? "alert" : "status"} className="text-13">
          {t(`notification_preferences.${message}`)}
        </p>
      )}
    </section>
  );
}
