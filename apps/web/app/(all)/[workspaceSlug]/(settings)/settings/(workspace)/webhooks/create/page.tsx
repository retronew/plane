import { useTranslation } from "@plane/i18n";
import { useEffect } from "react";
import { observer } from "mobx-react";
import { useNavigate, useParams } from "react-router";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { CreateWebhookModal } from "@/components/web-hooks/create-webhook-modal";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { useWebhook } from "@/hooks/store/use-webhook";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
import { WebhooksWorkspaceSettingsHeader } from "../header";

export default observer(function CreateWebhookPage() {
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createWebhook, clearSecretKey } = useWebhook();
  const { currentWorkspace } = useWorkspace();
  const { allowPermissions } = useUserPermissions();
  useEffect(() => {
    clearSecretKey();
    return () => clearSecretKey();
  }, [clearSecretKey]);
  if (!allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug))
    return <NotAuthorizedView section="settings" className="h-auto" />;
  return (
    <SettingsContentWrapper compact header={<WebhooksWorkspaceSettingsHeader currentPage={t("common.create")} />}>
      <CreateWebhookModal
        inline
        isOpen
        currentWorkspace={currentWorkspace}
        createWebhook={createWebhook}
        clearSecretKey={clearSecretKey}
        onClose={() => navigate(`/${workspaceSlug}/settings/webhooks/`)}
      />
    </SettingsContentWrapper>
  );
});
