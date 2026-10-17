/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useNavigate } from "react-router";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation, translate } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
// components
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsHeading } from "@/components/settings/heading";
import { WebhookSettingsLoader } from "@/components/ui/loader/settings/web-hook";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { WebhooksList } from "@/components/web-hooks";
// hooks
import { useWebhook } from "@/hooks/store/use-webhook";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { WebhooksWorkspaceSettingsHeader } from "./header";

function WebhooksListPage({ params }: Route.ComponentProps) {
  // states
  const navigate = useNavigate();
  // router
  const { workspaceSlug } = params;
  // plane hooks
  const { t } = useTranslation();
  // mobx store
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { fetchWebhooks, webhooks } = useWebhook();
  const { currentWorkspace } = useWorkspace();
  // derived values
  const canPerformWorkspaceAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  useSWR(
    canPerformWorkspaceAdminActions ? `WEBHOOKS_LIST_${workspaceSlug}` : null,
    canPerformWorkspaceAdminActions ? () => fetchWebhooks(workspaceSlug) : null
  );

  const pageTitle = currentWorkspace?.name
    ? translate("web.runtime.page_title", {
        name: currentWorkspace.name,
        section: t("workspace_settings.settings.webhooks.title"),
      })
    : undefined;

  if (workspaceUserInfo && !canPerformWorkspaceAdminActions) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  if (!webhooks) return <WebhookSettingsLoader />;

  return (
    <SettingsContentWrapper header={<WebhooksWorkspaceSettingsHeader />}>
      <PageHead title={pageTitle} />
      <div className="w-full">
        <SettingsHeading
          title={t("workspace_settings.settings.webhooks.title")}
          description={t("workspace_settings.settings.webhooks.description")}
          control={
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              label={t("workspace_settings.settings.webhooks.add_webhook")}
              onClick={() => navigate(`/${workspaceSlug}/settings/webhooks/create/`)}
            />
          }
        />
        {Object.keys(webhooks).length > 0 ? (
          <div className="mt-6">
            <WebhooksList />
          </div>
        ) : (
          <EmptyStateCompact
            assetKey="webhook"
            assetClassName="size-20"
            title={t("settings_empty_state.webhooks.title")}
            description={t("settings_empty_state.webhooks.description")}
            className="max-w-none"
            rootClassName="mt-6 min-h-60 rounded-lg border border-subtle px-6 py-10"
          />
        )}
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(WebhooksListPage);
