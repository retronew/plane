/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// types
import type { IWorkspaceIntegration, ISlackIntegration } from "@plane/types";
// ui
import { Loader } from "@plane/blocks/skeleton";
// fetch-keys
import { SLACK_CHANNEL_INFO } from "@plane/constants";
import { translate } from "@plane/i18n";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
import useIntegrationPopup from "@/hooks/use-integration-popup";
// services
import { AppInstallationService } from "@/services/app_installation.service";

type Props = {
  integration: IWorkspaceIntegration;
};

const appInstallationService = new AppInstallationService();

export const SelectChannel = observer(function SelectChannel({ integration }: Props) {
  // store hooks
  const { config } = useInstance();
  // states
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef(false);

  const { workspaceSlug, projectId } = useParams();

  // FIXME:
  const { startAuth } = useIntegrationPopup({
    provider: "slackChannel",
    stateParams: integration.id,
    // github_app_name: instance?.config?.github_client_id || "",
    slack_client_id: config?.slack_client_id || "",
  });

  const { data: projectIntegration, mutate } = useSWR<ISlackIntegration[]>(
    workspaceSlug && projectId && integration.id ? SLACK_CHANNEL_INFO(workspaceSlug, projectId) : null,
    () =>
      workspaceSlug && projectId && integration.id
        ? appInstallationService.getSlackChannelDetail(workspaceSlug, projectId, integration.id)
        : Promise.resolve([])
  );

  const slackChannel = projectIntegration?.find((channel) => channel.project === projectId);
  const slackChannelAvailabilityToggle = !!slackChannel;

  const handleDelete = async () => {
    if (!workspaceSlug || !projectId || !slackChannel || inFlight.current) return;
    inFlight.current = true;
    setDeleting(true);
    try {
      await appInstallationService.removeSlackChannel(workspaceSlug, projectId, integration.id, slackChannel.id);
      await mutate((channels) => channels?.filter((channel) => channel.id !== slackChannel.id), { revalidate: false });
    } catch (error) {
      console.error(error);
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  };

  const handleAuth = async () => {
    await startAuth();
  };

  return (
    <>
      {projectIntegration ? (
        <button
          type="button"
          className={`bg-gray-700 relative inline-flex h-4 w-6 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
          role="switch"
          aria-checked={slackChannelAvailabilityToggle}
          disabled={deleting}
          aria-label={translate("slack_integration.project_updates.project_updates_form.channel_dropdown.label")}
          onClick={() => {
            if (slackChannelAvailabilityToggle) {
              void handleDelete();
            } else {
              void handleAuth();
            }
          }}
        >
          <span
            aria-hidden="true"
            className={`shadow inline-block h-2 w-2 transform self-center rounded-full bg-white ring-0 transition duration-200 ease-in-out ${
              slackChannelAvailabilityToggle ? "translate-x-3" : "translate-x-0"
            }`}
          />
        </button>
      ) : (
        <Loader>
          <Loader.Item height="35px" width="150px" />
        </Loader>
      )}
    </>
  );
});
