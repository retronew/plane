/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { omit } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { ARCHIVABLE_STATE_GROUPS } from "@plane/constants";
import type { TIssue } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { translate } from "@plane/i18n";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
// helper
import { ArchiveIssueModal } from "../../archive-issue-modal";
import { DeleteIssueModal } from "../../delete-issue-modal";
import { CreateUpdateIssueModal } from "../../issue-modal/modal";
import type { IQuickActionProps } from "../list/list-view-types";
import type { MenuItemFactoryProps } from "./helper";
import { useAllIssueMenuItems } from "./helper";
import { IssueQuickActionMenu } from "./quick-action-menu";
import { useRelatedMenuItems } from "./related-menu-items";

export const AllIssueQuickActions = observer(function AllIssueQuickActions(props: IQuickActionProps) {
  const {
    issue,
    handleDelete,
    handleUpdate,
    handleArchive,
    customActionButton,
    readOnly = false,
    placements = "bottom-start",
    parentRef,
  } = props;
  // states
  const [createUpdateIssueModal, setCreateUpdateIssueModal] = useState(false);
  const [issueToEdit, setIssueToEdit] = useState<TIssue | undefined>(undefined);
  const [deleteIssueModal, setDeleteIssueModal] = useState(false);
  const [archiveIssueModal, setArchiveIssueModal] = useState(false);
  const [_, setDuplicateWorkItemModal] = useState(false);
  // router
  const { workspaceSlug } = useParams();
  const { getStateById } = useProjectState();
  const { getProjectIdentifierById } = useProject();
  // derived values
  const stateDetails = getStateById(issue.state_id);
  const isEditingAllowed = !readOnly;
  const projectIdentifier = getProjectIdentifierById(issue?.project_id);
  // auth
  const isArchivingAllowed = handleArchive && isEditingAllowed;
  const isInArchivableGroup = !!stateDetails && ARCHIVABLE_STATE_GROUPS.includes(stateDetails?.group);

  const duplicateIssuePayload = omit(
    {
      ...issue,
      name: translate("web.runtime.copy_name", { name: issue.name }),
      sourceIssueId: issue.id,
    },
    ["id"]
  );

  // Menu items and modals using helper
  const related = useRelatedMenuItems({ issue, workspaceSlug: workspaceSlug?.toString(), isEditingAllowed });

  const menuItemProps: MenuItemFactoryProps = {
    relatedMenuItems: related.menuItems,
    issue,
    workspaceSlug: workspaceSlug?.toString(),
    projectIdentifier,
    activeLayout: "Global issues",
    isEditingAllowed,
    isArchivingAllowed,
    isDeletingAllowed: isEditingAllowed,
    isInArchivableGroup,
    setIssueToEdit,
    setCreateUpdateIssueModal,
    setDeleteIssueModal,
    setArchiveIssueModal,
    setDuplicateWorkItemModal,
    handleDelete,
    handleUpdate,
    handleArchive,
    storeType: EIssuesStoreType.GLOBAL,
  };

  const MENU_ITEMS = useAllIssueMenuItems(menuItemProps);

  return (
    <>
      {/* Modals */}
      {related.modals}
      <ArchiveIssueModal
        data={issue}
        isOpen={archiveIssueModal}
        handleClose={() => setArchiveIssueModal(false)}
        onSubmit={handleArchive}
      />
      <DeleteIssueModal
        data={issue}
        isOpen={deleteIssueModal}
        handleClose={() => setDeleteIssueModal(false)}
        onSubmit={handleDelete}
      />
      <CreateUpdateIssueModal
        isOpen={createUpdateIssueModal}
        onClose={() => {
          setCreateUpdateIssueModal(false);
          setIssueToEdit(undefined);
        }}
        data={issueToEdit ?? duplicateIssuePayload}
        onSubmit={async (data) => {
          if (issueToEdit && handleUpdate) await handleUpdate(data);
        }}
        storeType={EIssuesStoreType.GLOBAL}
      />

      <IssueQuickActionMenu
        parentRef={parentRef}
        menuItems={MENU_ITEMS}
        placements={placements}
        customActionButton={customActionButton}
      />
    </>
  );
});
