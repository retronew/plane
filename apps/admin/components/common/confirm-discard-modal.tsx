/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { ConfirmDialog } from "@plane/blocks/dialog";
import { useTranslation } from "@plane/i18n";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  onDiscard: () => void;
};

export function ConfirmDiscardModal(props: Props) {
  const { isOpen, handleClose, onDiscard } = props;
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={handleClose}
      handleSubmit={onDiscard}
      isSubmitting={false}
      variant="primary"
      hideIcon
      title={t("admin.discard.title")}
      content={t("admin.discard.close_content")}
      primaryButtonText={{ default: t("admin.discard.discard") }}
      secondaryButtonText={t("admin.discard.keep_editing")}
    />
  );
}
