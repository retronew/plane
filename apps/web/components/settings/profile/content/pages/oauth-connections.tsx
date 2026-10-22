import { OAuthConnections } from "@/components/api-token/oauth-connections";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { useTranslation } from "@plane/i18n";

export function OAuthProfileSettings() {
  const { t } = useTranslation();
  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("account_settings.oauth.title")}
        description={t("account_settings.oauth.description")}
      />
      <OAuthConnections />
    </div>
  );
}
