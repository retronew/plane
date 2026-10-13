/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// ui
import { useParams } from "next/navigation";
import { setToast } from "@plane/blocks/toast";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { getPageName } from "@plane/utils";
// constants
// plane web hooks
import { useAppRouter } from "@/hooks/use-app-router";
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";
// store
import type { TPageInstance } from "@/store/pages/base-page";
import { translate } from "@plane/i18n";

type TConfirmPageDeletionProps = {
  isOpen: boolean;
  onClose: () => void;
  page: TPageInstance;
  storeType: EPageStoreType;
};

export const DeletePageModal = observer(function DeletePageModal(props: TConfirmPageDeletionProps) {
  const { isOpen, onClose, page, storeType } = props;
  // states
  const [isDeleting, setIsDeleting] = useState(false);
  // store hooks
  const { removePage } = usePageStore(storeType);

  // derived values
  const { id: pageId, name } = page;

  const handleClose = () => {
    setIsDeleting(false);
    onClose();
  };

  const router = useAppRouter();
  const { pageId: routePageId } = useParams();

  const handleDelete = async () => {
    if (!pageId) return;
    setIsDeleting(true);
    try {
      await removePage({ pageId });
      handleClose();
      setToast({
        type: "success",
        title: translate("toast.success"),
        message: translate("web.page_deleted_successfully"),
      });

      if (routePageId) {
        router.back();
      }
    } catch {
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: translate("web.page_could_not_be_deleted_please_try_again"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!page || !page.id) return null;

  return (
    <ConfirmDialog
      handleClose={handleClose}
      handleSubmit={handleDelete}
      isSubmitting={isDeleting}
      isOpen={isOpen}
      title={translate("web.delete_page")}
      content={
        <>
          {translate("web.delete_page_confirm_prefix")}{" "}
          <span className="font-medium break-words break-all text-primary">{getPageName(name)}</span>
          {translate("web.delete_page_confirm_suffix")}
        </>
      }
    />
  );
});
