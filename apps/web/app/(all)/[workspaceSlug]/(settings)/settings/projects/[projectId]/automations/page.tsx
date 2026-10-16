/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation, translate } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { IProject } from "@plane/types";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { AutoArchiveAutomation, AutoCloseAutomation, AutoRemindAutomation } from "@/components/automation";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import type { Route } from "./+types/page";
import { AutomationsProjectSettingsHeader } from "./header";

function AutomationSettingsPage({ params }: Route.ComponentProps) {
  // router
  const { workspaceSlug, projectId } = params;
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails: projectDetails, updateProject } = useProject();

  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  // derived values
  const canPerformProjectAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  const handleChange = async (formData: Partial<IProject>) => {
    if (!projectDetails) return;

    setIsSaving(true);
    try {
      await updateProject(workspaceSlug, projectId, formData);
    } catch (error) {
      setToast({
        type: "error",
        title: t("toast.error"),
        message: t("web.something_went_wrong_please_try_again"),
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // derived values
  const pageTitle = projectDetails?.name
    ? translate("web.runtime.page_title", { name: projectDetails?.name, section: translate("web.title_automations") })
    : undefined;

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<AutomationsProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <section className={`w-full ${canPerformProjectAdminActions ? "" : "opacity-60"}`}>
        <SettingsHeading
          title={t("project_settings.automations.heading")}
          description={t("project_settings.automations.description")}
        />
        <div className="mt-6 space-y-4">
          <AutoArchiveAutomation handleChange={handleChange} disabled={isSaving} />
          <AutoCloseAutomation handleChange={handleChange} disabled={isSaving} />
          <AutoRemindAutomation handleChange={handleChange} disabled={isSaving} />
        </div>
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(AutomationSettingsPage);
