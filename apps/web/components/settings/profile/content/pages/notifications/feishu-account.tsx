import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { NotificationPreferencesService } from "@plane/services";
import FeishuLogo from "@/app/assets/services/feishu.ico?url";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";

const service = new NotificationPreferencesService();
export function FeishuAccount() {
  const { t } = useTranslation();
  const { data, error, mutate } = useSWR("FEISHU_BINDING_STATUS", () => service.feishuStatus());
  return (
    <SettingsBoxedControlItem
      className="md:items-start"
      title={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-2">
            <img src={FeishuLogo} alt="" aria-hidden="true" className="size-5 shrink-0" />
            <span>{t("notification_preferences.channels.feishu")}</span>
          </span>
          {!error && (
            <span className="rounded-md bg-layer-1 px-2 py-0.5 text-caption-sm-regular text-secondary">
              {!data
                ? t("notification_preferences.loading")
                : data.binding
                  ? t("notification_preferences.feishu_linked", { name: data.binding.display_name })
                  : t("notification_preferences.feishu_unlinked")}
            </span>
          )}
        </span>
      }
      description={
        <>
          {error && <span role="alert">{t("notification_preferences.feishu_error")}</span>}
          <span className="block">{t("notification_preferences.feishu_description")}</span>
          {data && !data.enabled && <span className="block">{t("notification_preferences.feishu_disabled")}</span>}
        </>
      }
      control={
        error && (
          <Button
            stretch="auto"
            variant="secondary"
            size="sm"
            label={t("notification_preferences.retry")}
            onClick={() => void mutate()}
          />
        )
      }
    />
  );
}
