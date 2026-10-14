import { observer } from "mobx-react";
import { useParams } from "react-router";
import { KeyRound } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { APITokensProfileSettings } from "@/components/settings/profile/content/pages/api-tokens";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { useUserPermissions } from "@/hooks/store/user";

export default observer(function WorkspaceTokensPage() {
  const { workspaceSlug } = useParams();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();
  if (!workspaceSlug || !allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug))
    return <NotAuthorizedView section="settings" className="h-auto" />;
  return (
    <SettingsContentWrapper
      compact
      header={
        <SettingsPageHeader
          leftItem={
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-tertiary" />
              {t("web.workspace_tokens_title")}
            </div>
          }
        />
      }
    >
      <APITokensProfileSettings workspaceSlug={workspaceSlug} />
    </SettingsContentWrapper>
  );
});
