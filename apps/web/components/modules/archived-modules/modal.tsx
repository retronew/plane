/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// ui
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useAppRouter } from "@/hooks/use-app-router";
import { translate } from "@plane/i18n";

type Props = {
  workspaceSlug: string;
  projectId: string;
  moduleId: string;
  handleClose: () => void;
  isOpen: boolean;
  onSubmit?: () => Promise<void>;
};

export function ArchiveModuleModal(props: Props) {
  const { workspaceSlug, projectId, moduleId, isOpen, handleClose } = props;
  // router
  const router = useAppRouter();
  // states
  const [isArchiving, setIsArchiving] = useState(false);
  // store hooks
  const { getModuleNameById, archiveModule } = useModule();

  const moduleName = getModuleNameById(moduleId);

  const onClose = () => {
    setIsArchiving(false);
    handleClose();
  };

  const handleArchiveModule = async () => {
    setIsArchiving(true);
    try {
      await archiveModule(workspaceSlug, projectId, moduleId);
      setToast({
        type: "success",
        title: translate("web.archive_success"),
        message: translate("web.your_archives_can_be_found_in_project_archives"),
      });
      onClose();
      router.push(`/${workspaceSlug}/projects/${projectId}/modules`);
    } catch {
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: translate("web.module_could_not_be_archived_please_try_again"),
      });
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={onClose}
      handleSubmit={handleArchiveModule}
      isSubmitting={isArchiving}
      variant="primary"
      title={translate("web.runtime.archive_module", { name: moduleName })}
      content={translate("web.are_you_sure_you_want_to_archive_the_module_all_your_archive")}
      primaryButtonText={{ loading: translate("web.archiving"), default: translate("web.archive") }}
      secondaryButtonText={translate("web.cancel")}
    />
  );
}
