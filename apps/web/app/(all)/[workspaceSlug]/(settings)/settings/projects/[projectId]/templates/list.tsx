import { TemplatesOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { ConfigurationManager } from "@/components/settings/workspace/configuration/manager";
import { useUserPermissions } from "@/hooks/store/user";

export default observer(function ProjectTemplatesPage() {
  const { projectId } = useParams();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();
  if (!projectId || !allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT))
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
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
      <ConfigurationManager key={projectId} projectId={projectId} />
    </SettingsContentWrapper>
  );
});
