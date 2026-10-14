/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { TranslationWithNode } from "@/components/core/translation-with-node";
// ui
import { ConfirmDialog } from "@plane/blocks/dialog";
import { useTranslation } from "@plane/i18n";
// hooks
import { useUser } from "@/hooks/store/user";

export type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  userDetails: {
    id: string;
    display_name: string;
  };
};

export const ConfirmWorkspaceMemberRemove = observer(function ConfirmWorkspaceMemberRemove(props: Props) {
  const { isOpen, onClose, onSubmit, userDetails } = props;
  // states
  const [isRemoving, setIsRemoving] = useState(false);
  // store hooks
  const { data: currentUser } = useUser();
  const { t } = useTranslation();

  const handleClose = () => {
    onClose();
    setIsRemoving(false);
  };

  const handleDeletion = async () => {
    setIsRemoving(true);
    try {
      await onSubmit();
      handleClose();
    } catch (error) {
      // The caller surfaces the failure; keep the dialog open so the action can be retried.
      console.error(error);
      setIsRemoving(false);
    }
  };

  const isSelf = currentUser?.id === userDetails.id;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={handleClose}
      handleSubmit={handleDeletion}
      isSubmitting={isRemoving}
      title={
        isSelf
          ? t("web.member_management.leave_workspace_title")
          : t("web.member_management.remove_member_title", { name: userDetails?.display_name ?? "" })
      }
      content={
        isSelf ? (
          t("web.member_management.leave_workspace_description")
        ) : (
          <TranslationWithNode
            render={(name) => t("web.member_management.remove_workspace_member_description", { name })}
            node={<span className="font-bold">{userDetails?.display_name}</span>}
          />
        )
      }
      primaryButtonText={
        isSelf
          ? { loading: t("web.member_management.leaving"), default: t("web.member_management.leave_workspace") }
          : { loading: t("removing"), default: t("remove") }
      }
      secondaryButtonText={t("cancel")}
    />
  );
});
