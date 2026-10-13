/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
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
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useEstimate } from "@/hooks/store/estimates/use-estimate";
import { useProject } from "@/hooks/store/use-project";
import { translate } from "@plane/i18n";

type TDeleteEstimateModal = {
  workspaceSlug: string;
  projectId: string;
  estimateId: string | undefined;
  isOpen: boolean;
  handleClose: () => void;
};

export const DeleteEstimateModal = observer(function DeleteEstimateModal(props: TDeleteEstimateModal) {
  // props
  const { workspaceSlug, projectId, estimateId, isOpen, handleClose } = props;
  // hooks
  const { areEstimateEnabledByProjectId, deleteEstimate } = useProjectEstimates();
  const { asJson: estimate } = useEstimate(estimateId);
  const { updateProject } = useProject();
  // states
  const [buttonLoader, setButtonLoader] = useState(false);

  const handleDeleteEstimate = async () => {
    try {
      if (!workspaceSlug || !projectId || !estimateId) return;
      setButtonLoader(true);
      await deleteEstimate(workspaceSlug, projectId, estimateId);
      if (areEstimateEnabledByProjectId(projectId)) {
        await updateProject(workspaceSlug, projectId, { estimate: null });
      }
      setButtonLoader(false);
      setToast({
        type: "success",
        title: translate("web.estimate_deleted"),
        message: translate("web.estimate_has_been_removed_from_your_project"),
      });
      handleClose();
    } catch (_error) {
      setButtonLoader(false);
      setToast({
        type: "error",
        title: translate("web.estimate_creation_failed"),
        message: translate("web.we_were_unable_to_delete_the_estimate_please_try_again"),
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      disablePointerDismissal
      onOpenChange={(open, eventDetails) => {
        if (open) return;
        // The legacy modal took no `handleClose`, so Escape was swallowed: only Cancel closed it.
        if (eventDetails.reason === "escape-key") return;
        handleClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          {/* heading */}
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{translate("web.delete_estimate_system")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>

          {/* estimate steps */}
          <DialogBody tabIndex={0}>
            <div className="text-14 text-secondary">
              {translate("web.deleting_the_estimate")} <span className="font-bold text-primary">{estimate?.name}</span>
              &nbsp;system will remove it from all work items permanently. This action cannot be undone. If you add
              estimates again, you will need to update all the work items.
            </div>
          </DialogBody>
        </DialogMain>

        <DialogActions>
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={buttonLoader}
            stretch="auto"
            label={translate("web.cancel")}
          />
          <Button
            variant="danger"
            size="md"
            onClick={handleDeleteEstimate}
            disabled={buttonLoader}
            stretch="auto"
            label={buttonLoader ? translate("web.deleting_2") : translate("web.delete_estimate")}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
