/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { EUserPermissions, EUserPermissionsLevel, PROJECT_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { ProjectSettingsFeatureControlItem } from "@/components/settings/project/content/feature-control-item";
import { PROJECT_SETTINGS_ICONS } from "@/components/settings/project/sidebar/item-icon";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import type { Route } from "./+types/page";

const key = "web.project_overview";

function ProjectUpdatesSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { getProjectById } = useProject();
  const { t } = useTranslation();
  const project = getProjectById(projectId);
  const canManage = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);
  const title = t(`${key}.updates_settings_title`);
  const Icon = PROJECT_SETTINGS_ICONS.project_updates;

  if (workspaceUserInfo && !canManage) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper
      header={
        <SettingsPageHeader
          leftItem={
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink
                    label={t(PROJECT_SETTINGS.project_updates.i18n_label)}
                    icon={<Icon className="size-4 text-tertiary" />}
                  />
                }
              />
            </Breadcrumbs>
          }
        />
      }
    >
      <PageHead
        title={
          project?.name ? t("web.runtime.project_settings_title", { name: project.name, section: title }) : undefined
        }
      />
      <section className="w-full">
        <SettingsHeading title={title} description={t(`${key}.updates_settings_description`)} />
        <a
          className="mt-2 inline-block text-13 text-accent-primary hover:underline"
          href="https://docs.plane.so/communication-and-collaboration/project-updates#project-updates"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t(`${key}.updates_documentation`)}
        </a>
        <div className="mt-7">
          <ProjectSettingsFeatureControlItem
            title={t(`${key}.enable_updates`)}
            description={t(`${key}.enable_updates_description`)}
            featureProperty="project_updates_view"
            projectId={projectId}
            value={!!project?.project_updates_view}
            workspaceSlug={workspaceSlug}
            disabled={!canManage || !!project?.archived_at}
          />
        </div>
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(ProjectUpdatesSettingsPage);
