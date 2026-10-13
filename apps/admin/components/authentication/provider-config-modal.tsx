/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
// plane imports
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import type { IFormattedInstanceConfiguration } from "@plane/types";
// components
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
// hooks
import { useInstance } from "@/hooks/store";

export type TProviderConfigFormProps = {
  config: IFormattedInstanceConfiguration;
  /** Close the modal. Pass `force` after a successful save to skip the unsaved-changes check. */
  handleClose: (force?: boolean) => void;
  onDirtyChange: (isDirty: boolean) => void;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  renderForm: (props: TProviderConfigFormProps) => ReactNode;
};

export const ProviderConfigModal = observer(function ProviderConfigModal(props: Props) {
  const { isOpen, onClose, renderForm } = props;
  // states
  const [isDirty, setIsDirty] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  // store hooks
  const { formattedConfig } = useInstance();

  const handleClose = (force = false) => {
    if (!force && isDirty) {
      setIsDiscardModalOpen(true);
      return;
    }
    setIsDirty(false);
    onClose();
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent size="lg">
          {formattedConfig && renderForm({ config: formattedConfig, handleClose, onDirtyChange: setIsDirty })}
        </DialogContent>
      </Dialog>
      <ConfirmDiscardModal
        isOpen={isDiscardModalOpen}
        handleClose={() => setIsDiscardModalOpen(false)}
        onDiscard={() => {
          setIsDiscardModalOpen(false);
          handleClose(true);
        }}
      />
    </>
  );
});
