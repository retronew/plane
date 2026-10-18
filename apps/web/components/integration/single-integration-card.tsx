/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { TickCircleOutline } from "@makeplane/propel/icons";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import type { IAppIntegration, IWorkspaceIntegration } from "@plane/types";
// ui
import { Loader } from "@plane/blocks/skeleton";
// assets
import GithubLogo from "@/app/assets/services/github.png?url";
import SlackLogo from "@/app/assets/services/slack.png?url";
// constants
import { WORKSPACE_INTEGRATIONS } from "@plane/constants";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
import { useUserPermissions } from "@/hooks/store/user";
import useIntegrationPopup from "@/hooks/use-integration-popup";
import { usePlatformOS } from "@/hooks/use-platform-os";
// services
import { IntegrationService } from "@/services/integrations";
import { translate } from "@plane/i18n";

type Props = {
  integration: IAppIntegration;
};

const integrationDetails: { [key: string]: any } = {
  github: {
    logo: GithubLogo,
    installed: "Activate GitHub on individual projects to sync with specific repositories.",
    notInstalled: "Connect with GitHub with your Plane workspace to sync project work items.",
  },
  slack: {
    logo: SlackLogo,
    installed: "Activate Slack on individual projects to sync with specific channels.",
    notInstalled: "Connect with Slack with your Plane workspace to sync project work items.",
  },
};

// services
const integrationService = new IntegrationService();

export const SingleIntegrationCard = observer(function SingleIntegrationCard({ integration }: Props) {
  // states
  const [deletingIntegration, setDeletingIntegration] = useState(false);
  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const { config } = useInstance();
  const { allowPermissions } = useUserPermissions();

  const isUserAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const { isMobile } = usePlatformOS();
  const { startAuth, isConnecting: isInstalling } = useIntegrationPopup({
    provider: integration.provider,
    github_app_name: config?.github_app_name || "",
    slack_client_id: config?.slack_client_id || "",
  });

  const { data: workspaceIntegrations } = useSWR(workspaceSlug ? WORKSPACE_INTEGRATIONS(workspaceSlug) : null, () =>
    workspaceSlug ? integrationService.getWorkspaceIntegrationsList(workspaceSlug) : null
  );

  const handleRemoveIntegration = async () => {
    if (!workspaceSlug || !integration || !workspaceIntegrations) return;

    const workspaceIntegrationId = Array.isArray(workspaceIntegrations)
      ? workspaceIntegrations.find((i) => i.integration === integration.id)?.id
      : undefined;

    setDeletingIntegration(true);

    await integrationService
      .deleteWorkspaceIntegration(workspaceSlug, workspaceIntegrationId ?? "")
      .then(() => {
        mutate<IWorkspaceIntegration[]>(
          WORKSPACE_INTEGRATIONS(workspaceSlug),
          (prevData) => prevData?.filter((i) => i.id !== workspaceIntegrationId),
          false
        );
        setDeletingIntegration(false);

        setToast({
          type: "success",
          title: translate("web.deleted_successfully"),
          message: translate("web.ui.integration_deleted", { name: integration.title }),
        });
        return undefined;
      })
      .catch(() => {
        setDeletingIntegration(false);

        setToast({
          type: "error",
          title: translate("toast.error"),
          message: translate("web.ui.integration_delete_failed", { name: integration.title }),
        });
      });
  };

  const isInstalled = Array.isArray(workspaceIntegrations)
    ? workspaceIntegrations.find((i: IWorkspaceIntegration) => i.integration_detail.id === integration.id)
    : undefined;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-subtle bg-surface-1 px-4 py-6">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 flex-shrink-0">
          <img
            src={integrationDetails[integration.provider].logo}
            className="h-full w-full object-cover"
            alt={translate("web.runtime.provider_logo", { name: integration.title })}
          />
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-body-xs-medium">
            {integration.title}
            {workspaceIntegrations
              ? isInstalled && <TickCircleOutline className="h-3.5 w-3.5 fill-transparent text-success-primary" />
              : null}
          </h3>
          <p className="text-body-xs-regular text-secondary">
            {workspaceIntegrations
              ? isInstalled
                ? integrationDetails[integration.provider].installed
                : integrationDetails[integration.provider].notInstalled
              : translate("web.loading")}
          </p>
        </div>
      </div>

      {workspaceIntegrations ? (
        isInstalled ? (
          <Tooltip
            label={!isUserAdmin ? translate("web.you_don_t_have_permission_to_perform_this") : ""}
            layout="stacked"
            disabled={isUserAdmin || isMobile}
          >
            <Button
              render={
                <button
                  className={!isUserAdmin ? "hover:cursor-not-allowed" : ""}
                  aria-label={deletingIntegration ? translate("web.uninstalling") : translate("web.uninstall")}
                />
              }
              variant="danger"
              size="sm"
              stretch="auto"
              onClick={() => {
                if (!isUserAdmin) return;
                handleRemoveIntegration();
              }}
              disabled={!isUserAdmin}
              loading={deletingIntegration}
              label={deletingIntegration ? translate("web.uninstalling") : translate("web.uninstall")}
            />
          </Tooltip>
        ) : (
          <Tooltip
            label={!isUserAdmin ? translate("web.you_don_t_have_permission_to_perform_this") : ""}
            layout="stacked"
            disabled={isUserAdmin || isMobile}
          >
            <Button
              render={
                <button
                  className={!isUserAdmin ? "hover:cursor-not-allowed" : ""}
                  aria-label={isInstalling ? translate("web.installing") : translate("web.install")}
                />
              }
              variant="primary"
              size="sm"
              stretch="auto"
              onClick={() => {
                if (!isUserAdmin) return;
                startAuth();
              }}
              loading={isInstalling}
              label={isInstalling ? translate("web.installing") : translate("web.install")}
            />
          </Tooltip>
        )
      ) : (
        <Loader>
          <Loader.Item height="32px" width="64px" />
        </Loader>
      )}
    </div>
  );
});
