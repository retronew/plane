/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// ui
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogInfo,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { translate } from "@plane/i18n";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  onDiscard: () => void;
  onConfirm: () => Promise<void>;
};

export function ConfirmIssueDiscard(props: Props) {
  const { isOpen, handleClose, onDiscard, onConfirm } = props;

  const [isLoading, setIsLoading] = useState(false);

  const onClose = () => {
    handleClose();
    setIsLoading(false);
  };

  const handleDeletion = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="sm" data-save-draft-dialog="">
        <DialogMain data-confirm-main="">
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{translate("web.save_this_draft")}</DialogTitle>
              <DialogDescription data-confirm-description="">
                {translate("web.save_to_drafts_description")}
              </DialogDescription>
            </DialogHeading>
          </DialogHeader>
        </DialogMain>
        <DialogActions data-confirm-actions="">
          <DialogInfo>
            <Button variant="secondary" size="md" stretch="auto" onClick={onDiscard} label={translate("web.discard")} />
          </DialogInfo>
          <Button variant="secondary" size="md" stretch="auto" onClick={onClose} label={translate("web.cancel")} />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            onClick={() => void handleDeletion()}
            loading={isLoading}
            label={isLoading ? translate("web.saving") : translate("web.save_to_drafts")}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
