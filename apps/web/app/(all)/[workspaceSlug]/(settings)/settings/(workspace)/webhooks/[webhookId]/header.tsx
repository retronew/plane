import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { useWebhook } from "@/hooks/store/use-webhook";
import { WebhooksWorkspaceSettingsHeader } from "../header";

export const WebhookDetailsWorkspaceSettingsHeader = observer(function WebhookDetailsWorkspaceSettingsHeader() {
  const { currentWebhook } = useWebhook();
  const { t } = useTranslation();
  return (
    <WebhooksWorkspaceSettingsHeader
      currentPage={currentWebhook?.name || t("workspace_settings.settings.webhooks.modal.details")}
    />
  );
});
