import { Tab, Tabs, TabsList, TabsPanel } from "@makeplane/propel/components/tabs";
import { useTranslation } from "@plane/i18n";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { DailyDigestSettings } from "./daily-digest";
import { FeishuAccount } from "./feishu-account";
import { NotificationPreferencesTab } from "./preferences-tab";

export function NotificationsProfileSettings() {
  const { t } = useTranslation();
  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("notification_preferences.title")}
        description={t("notification_preferences.description")}
      />
      <div className="mt-5 min-w-0">
        <Tabs variant="underline" defaultValue="preferences">
          <TabsList aria-label={t("notification_preferences.title")}>
            <Tab value="preferences" label={t("notification_preferences.tabs.preferences")} />
            <Tab value="digest" label={t("notification_preferences.digest.title")} />
            <Tab value="accounts" label={t("notification_preferences.tabs.accounts")} />
          </TabsList>
          <TabsPanel value="preferences" keepMounted>
            <div className="pt-5">
              <NotificationPreferencesTab />
            </div>
          </TabsPanel>
          <TabsPanel value="digest" keepMounted>
            <div className="pt-5">
              <DailyDigestSettings />
            </div>
          </TabsPanel>
          <TabsPanel value="accounts" keepMounted>
            <section className="space-y-5 pt-5" aria-label={t("notification_preferences.tabs.accounts")}>
              <div>
                <h3 className="text-16 font-medium text-primary">{t("notification_preferences.tabs.accounts")}</h3>
                <p className="mt-1 text-13 text-secondary">{t("notification_preferences.tabs.accounts_description")}</p>
              </div>
              <FeishuAccount />
            </section>
          </TabsPanel>
        </Tabs>
      </div>
    </div>
  );
}
