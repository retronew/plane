/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRouter } from "next/navigation";
// plane imports
import { ConfirmDialog } from "@plane/blocks/dialog";
import { useTranslation } from "@plane/i18n";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  onDiscardHref: string;
};

export function ConfirmDiscardModal(props: Props) {
  const { isOpen, handleClose, onDiscardHref } = props;
  const { t } = useTranslation();
  // router
  const router = useRouter();

  // The confirm used to be a `<Link href={onDiscardHref}>`; ConfirmDialog's confirm is a button, so
  // it navigates through the router instead.
  const handleSubmit = () => {
    try {
      router.push(onDiscardHref);
    } catch (error) {
      console.error("Failed to discard changes and go back:", error);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={handleClose}
      handleSubmit={handleSubmit}
      isSubmitting={false}
      variant="primary"
      hideIcon
      title={t("admin.discard.title")}
      content={t("admin.discard.content")}
      primaryButtonText={{ default: t("admin.common.go_back") }}
      secondaryButtonText={t("admin.discard.keep_editing")}
    />
  );
}
