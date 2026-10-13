/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { WarningTriangleOutline } from "@makeplane/propel/icons";
// types
import { Button } from "@makeplane/propel/components/button";
import type { IUserLite } from "@plane/types";
// ui
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
import { useUser } from "@/hooks/store/user";
import { translate } from "@plane/i18n";

type Props = {
  data: Partial<IUserLite>;
  onSubmit: () => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
};

export const ConfirmProjectMemberRemove = observer(function ConfirmProjectMemberRemove(props: Props) {
  const { data, onSubmit, isOpen, onClose } = props;
  // router
  const { projectId } = useParams();
  // states
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  // store hooks
  const { data: currentUser } = useUser();
  const { getProjectById } = useProject();

  const handleClose = () => {
    onClose();
    setIsDeleteLoading(false);
  };

  const handleDeletion = async () => {
    setIsDeleteLoading(true);

    await onSubmit();

    handleClose();
  };

  if (!projectId) return <></>;

  const isCurrentUser = currentUser?.id === data?.id;
  const currentProjectDetails = getProjectById(projectId.toString());

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-subtle sm:mx-0 sm:h-10 sm:w-10">
                <WarningTriangleOutline className="h-6 w-6 text-danger-primary" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <DialogHeading>
                  <DialogTitle>
                    {isCurrentUser ? translate("web.leave_project_2") : `Remove ${data?.display_name}?`}
                  </DialogTitle>
                </DialogHeading>
              </div>
            </div>
          </DialogHeader>
          <DialogBody>
            <p className="text-13 text-secondary">
              {isCurrentUser ? (
                <>
                  {translate("web.are_you_sure_you_want_to_leave_the")}{" "}
                  <span className="font-bold">{currentProjectDetails?.name}</span> project? You will be able to join the
                  project if invited again or if it{"'"}s public.
                </>
              ) : (
                <>
                  {translate("web.are_you_sure_you_want_to_remove_member")}{" "}
                  <span className="font-bold">{data?.display_name}</span>? They will no longer have access to this
                  project. This action cannot be undone.
                </>
              )}
            </p>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button variant="secondary" size="md" stretch="auto" label={translate("web.cancel")} onClick={handleClose} />
          <Button
            variant="danger"
            size="md"
            stretch="auto"
            label={
              isCurrentUser
                ? isDeleteLoading
                  ? translate("web.leaving")
                  : translate("web.leave")
                : isDeleteLoading
                  ? translate("web.removing_2")
                  : translate("web.remove")
            }
            onClick={handleDeletion}
            loading={isDeleteLoading}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
