import { useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TTranslationKeys } from "@plane/i18n";
import type { TFeishuDelivery } from "@/types/feishu";

const statusKeys: Record<TFeishuDelivery["status"], TTranslationKeys> = {
  pending: "admin.feishu.delivery_pending",
  retry: "admin.feishu.delivery_retry",
  sent: "admin.feishu.delivery_sent",
  failed: "admin.feishu.delivery_failed",
  cancelled: "admin.feishu.delivery_cancelled",
};

const errorKeys: Record<string, TTranslationKeys> = {
  disabled_or_unbound: "admin.feishu.delivery_disabled_or_unbound",
  no_longer_eligible: "admin.feishu.delivery_no_longer_eligible",
  transport_error: "admin.feishu.delivery_transport_error",
  http_429: "admin.feishu.delivery_rate_limited",
  provider_230013: "admin.feishu.delivery_permission_error",
};

export function FeishuDeliveryStatus({
  delivery,
  refresh,
  disabled,
}: {
  delivery: TFeishuDelivery | null;
  refresh: () => Promise<unknown>;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      setToast({ type: "error", title: t("admin.common.error"), message: t("admin.feishu.load_failed") });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 border-t border-subtle pt-6" aria-labelledby="feishu-last-delivery">
      <h2 id="feishu-last-delivery" className="text-13 font-medium text-primary">
        {t("admin.feishu.last_delivery")}
      </h2>
      <output className="flex flex-col gap-2 text-13 text-secondary">
        {delivery ? (
          <>
            <span>{t(statusKeys[delivery.status] ?? "admin.feishu.delivery_unknown")}</span>
            <span>{t("admin.feishu.delivery_created", { date: new Date(delivery.created_at) })}</span>
            {delivery.sent_at && (
              <span>{t("admin.feishu.delivery_sent_at", { date: new Date(delivery.sent_at) })}</span>
            )}
            {delivery.last_error && (
              <span>
                {t(
                  Object.hasOwn(errorKeys, delivery.last_error)
                    ? errorKeys[delivery.last_error]
                    : "admin.feishu.delivery_error"
                )}
              </span>
            )}
          </>
        ) : (
          t("admin.feishu.no_delivery")
        )}
      </output>
      <div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          stretch="auto"
          disabled={disabled || refreshing}
          loading={refreshing}
          label={t("admin.feishu.refresh_status")}
          onClick={() => void onRefresh()}
        />
      </div>
    </section>
  );
}
