/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useSyncExternalStore } from "react";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import {
  composerCacheKey,
  readComposerDraft,
  subscribeComposerDrafts,
} from "@/components/issues/issue-modal/composer-cache";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { IntakeOutline, RefreshOutline } from "@makeplane/propel/icons";
// ui
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { InboxIssueCreateModalRoot } from "@/components/inbox/modals/create-modal";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { useUser, useUserPermissions } from "@/hooks/store/user";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/components/breadcrumbs/common";
import { useProjectCrumbProps } from "@/components/breadcrumbs/use-project-crumb-props";

export const ProjectInboxHeader = observer(function ProjectInboxHeader() {
  // states
  const [createIssueModal, setCreateIssueModal] = useState(false);
  // router
  const { workspaceSlug, projectId } = useParams();
  const projectCrumb = useProjectCrumbProps(workspaceSlug?.toString(), projectId?.toString());
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();
  const { data: user } = useUser();
  const cacheKey =
    user?.id && workspaceSlug && projectId
      ? composerCacheKey(user.id, workspaceSlug.toString(), `intake:${projectId.toString()}`)
      : undefined;
  const hasSavedRequest = useSyncExternalStore(
    subscribeComposerDrafts,
    () => Boolean(cacheKey && readComposerDraft(cacheKey)),
    () => false
  );

  const { currentProjectDetails, loader: currentProjectDetailsLoader } = useProject();
  const { loader } = useProjectInbox();

  // derived value
  const isAuthorized = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
    EUserPermissionsLevel.PROJECT
  );

  return (
    <Header>
      <Header.LeftItem>
        <div className="flex flex-grow items-center gap-4">
          <Breadcrumbs isLoading={currentProjectDetailsLoader === "init-loader"}>
            <CommonProjectBreadcrumbs
              workspaceSlug={workspaceSlug?.toString()}
              projectId={projectId?.toString()}
              {...projectCrumb}
            />
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink
                  label={t("web.intake")}
                  href={`/${workspaceSlug}/projects/${projectId}/intake/`}
                  icon={<IntakeOutline className="h-4 w-4 text-tertiary" />}
                  isLast
                />
              }
              isLast
            />
          </Breadcrumbs>

          {loader === "pagination-loading" && (
            <div className="flex items-center gap-1.5 text-tertiary">
              <RefreshOutline className="h-3.5 w-3.5 animate-spin" />
              <p className="text-13">{t("syncing")}...</p>
            </div>
          )}
        </div>
      </Header.LeftItem>
      <Header.RightItem>
        {currentProjectDetails?.inbox_view && workspaceSlug && projectId && isAuthorized ? (
          <div className="flex items-center gap-2">
            <InboxIssueCreateModalRoot
              workspaceSlug={workspaceSlug.toString()}
              projectId={projectId.toString()}
              modalState={createIssueModal}
              handleModalClose={() => setCreateIssueModal(false)}
            />
            <Tooltip label={t("web.runtime.intake_restore_request")} disabled={!hasSavedRequest}>
              <Button
                data-intake-request-trigger={projectId.toString()}
                variant="primary"
                size="md"
                stretch="auto"
                label={t("web.runtime.intake_submit_request")}
                iconPosition="end"
                icon={
                  hasSavedRequest ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : undefined
                }
                onClick={() => setCreateIssueModal(true)}
              />
            </Tooltip>
          </div>
        ) : (
          <></>
        )}
      </Header.RightItem>
    </Header>
  );
});
