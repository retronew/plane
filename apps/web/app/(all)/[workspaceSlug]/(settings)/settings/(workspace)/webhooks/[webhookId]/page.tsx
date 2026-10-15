/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import type { IWebhook } from "@plane/types";
// ui
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { DeleteWebhookModal, WebhookDeleteSection, WebhookForm } from "@/components/web-hooks";
// hooks
import { useWebhook } from "@/hooks/store/use-webhook";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { WebhookDetailsWorkspaceSettingsHeader } from "./header";
import { translate } from "@plane/i18n";

function WebhookDetailsPage({ params }: Route.ComponentProps) {
  // states
  const [deleteWebhookModal, setDeleteWebhookModal] = useState(false);
  // router
  const { workspaceSlug, webhookId } = params;
  // mobx store
  const { currentWebhook, fetchWebhookById, updateWebhook } = useWebhook();
  const { currentWorkspace } = useWorkspace();
  const { allowPermissions } = useUserPermissions();

  // TODO: fix this error
  // useEffect(() => {
  //   if (isCreated !== "true") clearSecretKey();
  // }, [clearSecretKey, isCreated]);
  // derived values
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const pageTitle = currentWorkspace?.name
    ? translate("web.runtime.page_title", { name: currentWorkspace.name, section: translate("web.title_webhook") })
    : undefined;

  useSWR(
    isAdmin ? `WEBHOOK_DETAILS_${workspaceSlug}_${webhookId}` : null,
    isAdmin ? () => fetchWebhookById(workspaceSlug, webhookId) : null
  );

  const handleUpdateWebhook = async (formData: IWebhook) => {
    if (!formData || !formData.id) return;

    const payload = {
      url: formData.url,
      name: formData.name,
      events: formData.events ?? [],
      is_active: formData.is_active,
      project: formData.project,
      cycle: formData.cycle,
      module: formData.module,
      issue: formData.issue,
      issue_comment: formData.issue_comment,
    };

    try {
      await updateWebhook(workspaceSlug, formData.id, payload);
      setToast({
        type: "success",
        title: translate("toast.success"),
        message: translate("web.webhook_updated_successfully"),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: error?.error ?? translate("web.something_went_wrong_please_try_again"),
      });
    }
  };

  if (!isAdmin)
    return (
      <>
        <PageHead title={pageTitle} />
        <div className="mt-10 flex h-full w-full justify-center p-4">
          <p className="text-13 text-tertiary">{translate("web.you_are_not_authorized_to_access_this_page")}</p>
        </div>
      </>
    );

  if (!currentWebhook)
    return (
      <div className="grid h-full w-full place-items-center p-4">
        <LogoSpinner />
      </div>
    );

  return (
    <SettingsContentWrapper compact header={<WebhookDetailsWorkspaceSettingsHeader />}>
      <PageHead title={pageTitle} />
      <DeleteWebhookModal isOpen={deleteWebhookModal} onClose={() => setDeleteWebhookModal(false)} />
      <div className="w-full space-y-8 overflow-y-auto">
        <div>
          <WebhookForm onSubmit={handleUpdateWebhook} data={currentWebhook} />
        </div>
        {currentWebhook && <WebhookDeleteSection openDeleteModal={() => setDeleteWebhookModal(true)} />}
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(WebhookDetailsPage);
