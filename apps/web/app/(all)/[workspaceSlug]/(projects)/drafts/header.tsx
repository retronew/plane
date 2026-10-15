/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// ui
import { Button } from "@makeplane/propel/components/button";
import { DraftsOutline } from "@makeplane/propel/icons";
import { EIssuesStoreType } from "@plane/types";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Header } from "@plane/blocks/layout";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { CountChip } from "@/components/common/count-chip";
import { CreateUpdateIssueModal } from "@/components/issues/issue-modal/modal";
import {
  composerCacheKey,
  composerDraftContext,
  readComposerDraft,
  subscribeComposerDrafts,
} from "@/components/issues/issue-modal/composer-cache";

// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useWorkspaceDraftIssues } from "@/hooks/store/workspace-draft";

export const WorkspaceDraftHeader = observer(function WorkspaceDraftHeader() {
  // state
  const [isDraftIssueModalOpen, setIsDraftIssueModalOpen] = useState(false);
  const { workspaceSlug } = useParams();
  const { data: currentUser } = useUser();
  const hasPendingDraft = useSyncExternalStore(
    subscribeComposerDrafts,
    () =>
      !!(
        currentUser?.id &&
        workspaceSlug &&
        readComposerDraft(
          composerCacheKey(currentUser.id, workspaceSlug.toString(), composerDraftContext(undefined, undefined, true))
        )
      ),
    () => false
  );
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { paginationInfo } = useWorkspaceDraftIssues();
  const { joinedProjectIds } = useProject();

  const { t } = useTranslation();
  // check if user is authorized to create draft work item
  const isAuthorizedUser = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  return (
    <>
      <CreateUpdateIssueModal
        isOpen={isDraftIssueModalOpen}
        storeType={EIssuesStoreType.WORKSPACE_DRAFT}
        onClose={() => setIsDraftIssueModalOpen(false)}
        isDraft
      />
      <Header>
        <Header.LeftItem>
          <div className="flex items-center gap-2.5">
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink label={t("drafts")} icon={<DraftsOutline className="h-4 w-4 text-tertiary" />} />
                }
              />
            </Breadcrumbs>
            {paginationInfo?.total_count && paginationInfo?.total_count > 0 ? (
              <CountChip count={paginationInfo?.total_count} />
            ) : (
              <></>
            )}
          </div>
        </Header.LeftItem>

        <Header.RightItem>
          {joinedProjectIds && joinedProjectIds.length > 0 && (
            <span className="relative inline-flex">
              <Button
                data-draft-work-item-trigger=""
                variant="primary"
                size="md"
                stretch="auto"
                label={t("workspace_draft_issues.draft_an_issue")}
                onClick={() => setIsDraftIssueModalOpen(true)}
                disabled={!isAuthorizedUser}
              />
              {hasPendingDraft && !isDraftIssueModalOpen && (
                <span
                  data-draft-composer-indicator=""
                  title={t("workspace_draft_issues.temporarily_saved")}
                  className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-inverse"
                >
                  <span className="sr-only">{t("workspace_draft_issues.temporarily_saved")}</span>
                </span>
              )}
            </span>
          )}
        </Header.RightItem>
      </Header>
    </>
  );
});
