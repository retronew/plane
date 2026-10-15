/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SettingsSidebarToggle } from "../../sidebar/collapse";
import { SettingsSidebarHeaderRow } from "../../sidebar/header-row";
import { ArrowNarrowLeftOutline } from "@makeplane/propel/icons";
import { observer } from "mobx-react";
import Link from "next/link";
// plane imports
import { ROLE_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Icon } from "@makeplane/propel/components/icon";
// components
import { WorkspaceLogo } from "@/components/workspace/logo";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useWorkspace } from "@/hooks/store/use-workspace";

export const WorkspaceSettingsSidebarHeader = observer(function WorkspaceSettingsSidebarHeader() {
  // router
  const router = useAppRouter();
  // store hooks
  const { getWorkspaceRoleByWorkspaceSlug } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();
  // derived values
  const currentWorkspaceRole = currentWorkspace?.slug
    ? getWorkspaceRoleByWorkspaceSlug(currentWorkspace.slug)
    : undefined;
  // translation
  const { t } = useTranslation();

  if (!currentWorkspaceRole) return null;

  return (
    <div className="shrink-0">
      <SettingsSidebarHeaderRow>
        <IconButton
          variant="tertiary"
          size="sm"
          icon={<Icon icon={ArrowNarrowLeftOutline} />}
          aria-label={t("back_to_workspace")}
          onClick={() => router.push(`/${currentWorkspace?.slug}/`)}
        />
        <p className="min-w-0 flex-1 truncate">{t("web.workspace_settings")}</p>
        <SettingsSidebarToggle />
      </SettingsSidebarHeaderRow>
      <div className="mt-1.5 px-3">
        <Link
          href={`/${currentWorkspace?.slug}/settings/`}
          aria-label={`${currentWorkspace?.name} · ${t("general_settings")}`}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-0.5 outline-none hover:bg-layer-transparent-hover focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-inset"
        >
          <WorkspaceLogo
            logo={currentWorkspace?.logo_url}
            name={currentWorkspace?.name}
            classNames="shrink-0 size-8 border border-subtle"
          />
          <div className="truncate">
            <p className="truncate text-body-sm-medium">{currentWorkspace?.name}</p>
            <p className="truncate text-caption-md-regular">{t(ROLE_DETAILS[currentWorkspaceRole].i18n_title)}</p>
          </div>
        </Link>
      </div>
    </div>
  );
});
