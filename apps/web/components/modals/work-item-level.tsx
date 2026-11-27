/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { TIssue } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useIssuesActions } from "@/hooks/use-issues-actions";

const BulkDeleteIssuesModal = lazy(() =>
  import("@/components/core/modals/bulk-delete-issues-modal").then((m) => ({ default: m.BulkDeleteIssuesModal }))
);
const DeleteIssueModal = lazy(() =>
  import("@/components/issues/delete-issue-modal").then((m) => ({ default: m.DeleteIssueModal }))
);
const CreateUpdateIssueModal = lazy(() =>
  import("@/components/issues/issue-modal/modal").then((m) => ({ default: m.CreateUpdateIssueModal }))
);

export type TWorkItemLevelModalsProps = {
  workItemIdentifier: string | undefined;
};

export const WorkItemLevelModals = observer(function WorkItemLevelModals(props: TWorkItemLevelModalsProps) {
  const { workItemIdentifier } = props;
  // router
  const { workspaceSlug, cycleId, moduleId } = useParams();
  const router = useAppRouter();
  // store hooks
  const { data: currentUser } = useUser();
  const {
    issue: { getIssueById, getIssueIdByIdentifier },
  } = useIssueDetail();
  // derived values
  const workItemId = workItemIdentifier ? getIssueIdByIdentifier(workItemIdentifier) : undefined;
  const workItemDetails = workItemId ? getIssueById(workItemId) : undefined;

  const { removeIssue: removeWorkItem } = useIssuesActions(EIssuesStoreType.PROJECT);

  const {
    isCreateIssueModalOpen,
    toggleCreateIssueModal,
    isDeleteIssueModalOpen,
    toggleDeleteIssueModal,
    isBulkDeleteIssueModalOpen,
    toggleBulkDeleteIssueModal,
    createWorkItemAllowedProjectIds,
  } = useCommandPalette();
  // derived values
  const { fetchSubIssues: fetchSubWorkItems } = useIssueDetail();

  // oxlint-disable-next-line no-shadow
  const handleDeleteIssue = async (workspaceSlug: string, projectId: string, issueId: string) => {
    try {
      const redirectPath = `/${workspaceSlug}/projects/${projectId}/issues`;

      await removeWorkItem(projectId, issueId);
      router.push(redirectPath);
    } catch (error) {
      console.error("Failed to delete issue:", error);
    }
  };

  const handleCreateIssueSubmit = async (newIssue: TIssue) => {
    if (!workspaceSlug || !newIssue.project_id || !newIssue.id || newIssue.parent_id !== workItemDetails?.id) return;

    await fetchSubWorkItems(workspaceSlug?.toString(), newIssue.project_id, workItemDetails.id);
  };

  const getCreateIssueModalData = () => {
    if (cycleId) return { cycle_id: cycleId.toString() };
    if (moduleId) return { module_ids: [moduleId.toString()] };
    return undefined;
  };

  return (
    <Suspense fallback={null}>
      {isCreateIssueModalOpen && (
        <CreateUpdateIssueModal
          isOpen={isCreateIssueModalOpen}
          onClose={() => toggleCreateIssueModal(false)}
          data={getCreateIssueModalData()}
          onSubmit={handleCreateIssueSubmit}
          allowedProjectIds={createWorkItemAllowedProjectIds}
        />
      )}
      {isDeleteIssueModalOpen && workspaceSlug && workItemId && workItemDetails && workItemDetails.project_id && (
        <DeleteIssueModal
          handleClose={() => toggleDeleteIssueModal(false)}
          isOpen={isDeleteIssueModalOpen}
          data={workItemDetails}
          onSubmit={() =>
            handleDeleteIssue(workspaceSlug.toString(), workItemDetails.project_id!, workItemId?.toString())
          }
        />
      )}
      {isBulkDeleteIssueModalOpen && (
        <BulkDeleteIssuesModal
          isOpen={isBulkDeleteIssueModalOpen}
          onClose={() => toggleBulkDeleteIssueModal(false)}
          user={currentUser}
        />
      )}
    </Suspense>
  );
});
