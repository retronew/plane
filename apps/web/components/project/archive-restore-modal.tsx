/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// ui
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";
import { translate } from "@plane/i18n";

type Props = {
  workspaceSlug: string;

  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  archive: boolean;
};

export function ArchiveRestoreProjectModal(props: Props) {
  const { workspaceSlug, projectId, isOpen, onClose, archive } = props;
  // router
  const router = useAppRouter();
  // states
  const [isLoading, setIsLoading] = useState(false);
  // store hooks
  const { getProjectById, archiveProject, restoreProject } = useProject();

  const projectDetails = getProjectById(projectId);
  if (!projectDetails) return null;

  const handleClose = () => {
    setIsLoading(false);
    onClose();
  };

  const handleArchiveProject = async () => {
    setIsLoading(true);
    await archiveProject(workspaceSlug, projectId)
      .then(() => {
        setToast({
          type: "success",
          title: translate("web.archive_success"),
          message: translate("web.ui.project_archived", { name: projectDetails.name }),
        });
        onClose();
        router.push(`/${workspaceSlug}/projects/`);
        return;
      })
      .catch(() =>
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: translate("web.project_could_not_be_archived_please_try_again"),
        })
      )
      .finally(() => setIsLoading(false));
  };

  const handleRestoreProject = async () => {
    setIsLoading(true);
    await restoreProject(workspaceSlug, projectId)
      .then(() => {
        setToast({
          type: "success",
          title: translate("web.restore_success"),
          message: translate("web.ui.project_restored_location", { name: projectDetails.name }),
        });
        onClose();
        router.push(`/${workspaceSlug}/projects/`);
        return;
      })
      .catch(() =>
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: translate("web.project_could_not_be_restored_please_try_again"),
        })
      )
      .finally(() => setIsLoading(false));
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>
                {archive ? translate("web.archive") : translate("web.restore")} {projectDetails.name}
              </DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <p className="text-13 text-secondary">
              {archive
                ? translate("web.this_project_and_its_work_items_cycles_modules_and_pages_wil")
                : translate("web.restoring_a_project_will_activate_it_and_make_it_visible_to")}
            </p>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" label={translate("web.cancel")} onClick={onClose} />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={
              archive
                ? isLoading
                  ? translate("web.archiving")
                  : translate("web.archive")
                : isLoading
                  ? translate("web.restoring")
                  : translate("web.restore")
            }
            onClick={archive ? handleArchiveProject : handleRestoreProject}
            loading={isLoading}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
