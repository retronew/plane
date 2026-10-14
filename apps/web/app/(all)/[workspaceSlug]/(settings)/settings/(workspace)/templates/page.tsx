import { TemplatesOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { useUserPermissions } from "@/hooks/store/user";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { ConfigurationManager } from "@/components/settings/workspace/configuration/manager";
export default observer(function TemplatesPage() {
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();
  if (!allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE))
    return <NotAuthorizedView section="settings" className="h-auto" />;
  return (
    <SettingsContentWrapper
      compact
      header={
        <SettingsPageHeader
          leftItem={
            <div className="flex items-center gap-2">
              <TemplatesOutline className="size-4 text-tertiary" />
              <span>{t("web.templates")}</span>
            </div>
          }
        />
      }
    >
      <ConfigurationManager />
    </SettingsContentWrapper>
  );
});
