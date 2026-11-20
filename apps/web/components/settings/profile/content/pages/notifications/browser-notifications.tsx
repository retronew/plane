import { Button } from "@makeplane/propel/components/button";
import { Switch } from "@makeplane/propel/components/switch";
import { useTranslation } from "@plane/i18n";
import { SettingsControlItem } from "@/components/settings/control-item";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";

export function BrowserNotificationsSettings() {
  const { t } = useTranslation();
  const { enabled, supported, permission, error, busy, setEnabled, requestPermission, sendTest } =
    useBrowserNotifications();
  const status = supported ? permission : "unsupported";

  return (
    <section className="space-y-5" aria-label={t("notification_preferences.browser.title")}>
      <div>
        <h3 className="text-16 font-medium text-primary">{t("notification_preferences.browser.title")}</h3>
        <p className="mt-1 text-13 text-secondary">{t("notification_preferences.browser.description")}</p>
      </div>
      <SettingsControlItem
        title={t("notification_preferences.browser.enabled")}
        description={t("notification_preferences.browser.enabled_description")}
        control={
          <Switch
            size="md"
            checked={enabled}
            disabled={!supported || busy}
            aria-label={t("notification_preferences.browser.enabled")}
            onCheckedChange={setEnabled}
          />
        }
      />
      <div className="space-y-3 border-t border-subtle pt-5">
        <output className="block space-y-1">
          <span className="block text-13 font-medium text-primary">
            {t(`notification_preferences.browser.status.${status}`)}
          </span>
          <span className="block text-13 text-secondary">
            {t(`notification_preferences.browser.status_description.${status}`)}
          </span>
        </output>
        <div className="flex flex-wrap gap-3">
          {supported && permission === "default" && (
            <Button
              variant="primary"
              size="sm"
              stretch="auto"
              label={t("notification_preferences.browser.allow")}
              disabled={!enabled || busy}
              onClick={() => void requestPermission()}
            />
          )}
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label={t("notification_preferences.browser.test")}
            disabled={!supported || !enabled || permission !== "granted" || busy}
            onClick={() => void sendTest()}
          />
        </div>
        {error && (
          <p role="alert" className="text-13 text-danger-primary">
            {t("notification_preferences.browser.error")}
          </p>
        )}
      </div>
      <p className="text-13 text-secondary">{t("notification_preferences.browser.availability")}</p>
    </section>
  );
}
