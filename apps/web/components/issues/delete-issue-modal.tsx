/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLayoutEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// types
import { PROJECT_ERROR_MESSAGES, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation, Translation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TDeDupeIssue, TIssue } from "@plane/types";
// ui
import { ConfirmDialog } from "@plane/blocks/dialog";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  dataId?: string | null | undefined;
  data?: TIssue | TDeDupeIssue;
  isSubIssue?: boolean;
  onSubmit?: () => Promise<void>;
};

export const DeleteIssueModal = observer(function DeleteIssueModal(props: Props) {
  const { dataId, data, isOpen, handleClose, isSubIssue = false, onSubmit } = props;
  // store hooks
  const { workspaceSlug } = useParams();
  const { issueMap } = useIssues();
  const { getProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();

  const { data: currentUser } = useUser();

  // A session survives ordinary rerenders, but not reopening or changing the target.
  // Keep the dialog mounted across close so its exit animation can finish.
  const issue = data ?? (dataId ? issueMap[dataId] : undefined);
  const entityId = issue?.id ?? dataId;
  const projectId = issue?.project_id;
  const session = useMemo(
    () => ({ active: false, pending: false, isOpen, entityId, projectId, workspaceSlug, isSubIssue }),
    [isOpen, entityId, projectId, workspaceSlug, isSubIssue]
  );
  const [submittingSession, setSubmittingSession] = useState<typeof session | null>(null);
  const isDeleting = submittingSession === session;
  useLayoutEffect(() => {
    session.active = isOpen;
    return () => {
      session.active = false;
    };
  }, [session, isOpen]);

  if (!dataId && !data) return null;
  const projectDetails = getProjectById(issue?.project_id);
  const isIssueCreator = issue?.created_by === currentUser?.id;

  const canPerformProjectAdminActions = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug?.toString(),
    projectDetails?.id
  );

  const authorized = isIssueCreator || canPerformProjectAdminActions;

  const onClose = () => {
    if (!session.active) return;
    session.active = false;
    setSubmittingSession(null);
    handleClose();
  };

  const handleIssueDelete = async () => {
    if (!session.active || session.pending) return;

    if (!authorized) {
      setToast({
        title: t(PROJECT_ERROR_MESSAGES.permissionError.i18n_title),
        type: "error",
        message:
          PROJECT_ERROR_MESSAGES.permissionError.i18n_message && t(PROJECT_ERROR_MESSAGES.permissionError.i18n_message),
      });
      onClose();
      return;
    }
    if (!onSubmit) return;
    session.pending = true;
    setSubmittingSession(session);
    try {
      await onSubmit();
      if (!session.active) return;
      setToast({
        type: "success",
        title: t("common.success"),
        message: t("entity.delete.success", {
          entity: isSubIssue ? t("common.sub_work_item") : t("common.work_item"),
        }),
      });
    } catch (errors) {
      if (!session.active) return;
      const isPermissionError =
        (errors as { error?: string } | undefined)?.error ===
        `Only admin or creator can delete the ${isSubIssue ? "sub-work item" : "work item"}`;
      const currentError = isPermissionError
        ? PROJECT_ERROR_MESSAGES.permissionError
        : PROJECT_ERROR_MESSAGES.issueDeleteError;
      setToast({
        title: t(currentError.i18n_title),
        type: "error",
        message: currentError.i18n_message && t(currentError.i18n_message),
      });
    } finally {
      onClose();
    }
  };

  return (
    <ConfirmDialog
      handleClose={onClose}
      handleSubmit={handleIssueDelete}
      isSubmitting={isDeleting}
      isOpen={isOpen}
      title={t("entity.delete.label", { entity: t("common.work_item") })}
      content={
        <Translation
          translationKey="web.runtime.delete_issue_confirmation"
          values={{ type: "issue" }}
          components={{
            identifier: (
              <span className="font-medium break-words text-primary">
                {projectDetails?.identifier}-{issue?.sequence_id}
              </span>
            ),
          }}
        />
      }
    />
  );
});
