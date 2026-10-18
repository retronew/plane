/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// Plane imports
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { setToast } from "@plane/blocks/toast";
import { useTranslation, translate } from "@plane/i18n";
import type { IModule } from "@plane/types";
// components
import { ModuleForm } from "@/components/modules";
import { getDialogInitialFocusProps } from "@/helpers/dialog";
// hooks
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  data?: IModule;
  workspaceSlug: string;
  projectId: string;
};

export const CreateUpdateModuleModal = observer(function CreateUpdateModuleModal(props: Props) {
  const { isOpen, onClose, data, workspaceSlug, projectId } = props;
  // states
  const initialProject = data?.project_id ?? projectId;
  const identity = `${workspaceSlug}/${projectId}/${data?.id ?? "create"}`;
  const [session, setSession] = useState({ identity, isOpen, generation: 0 });
  const [activeProject, setActiveProject] = useState<string | null>(initialProject);
  if (session.identity !== identity || session.isOpen !== isOpen) {
    setSession({ identity, isOpen, generation: session.generation + (isOpen ? 1 : 0) });
    if (isOpen) setActiveProject(initialProject);
  }
  const currentSession = useRef(session);
  useLayoutEffect(() => {
    currentSession.current = session;
    return () => {
      currentSession.current = { ...session, isOpen: false };
    };
  }, [session]);
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { workspaceProjectIds } = useProject();
  const { createModule, updateModuleDetails } = useModule();
  const { isMobile } = usePlatformOS();

  const handleClose = () => {
    onClose();
  };

  const handleCreateModule = async (payload: Partial<IModule>) => {
    if (!workspaceSlug || !projectId) return;

    const requestSession = currentSession.current;
    const selectedProjectId = data?.project_id ?? payload.project_id ?? activeProject ?? projectId.toString();
    await createModule(workspaceSlug.toString(), selectedProjectId, payload)
      .then((_res) => {
        if (currentSession.current !== requestSession || !currentSession.current.isOpen) return;
        handleClose();
        setToast({
          type: "success",
          title: t("toast.success"),
          message: t("web.module_created_successfully"),
        });
        return undefined;
      })
      .catch((err) => {
        if (currentSession.current !== requestSession || !currentSession.current.isOpen) return;
        setToast({
          type: "error",
          title: t("toast.error"),
          message: err?.detail ?? err?.error ?? t("web.module_could_not_be_created_please_try_again"),
        });
      });
  };

  const handleUpdateModule = async (payload: Partial<IModule>) => {
    if (!workspaceSlug || !projectId || !data) return;

    const requestSession = currentSession.current;
    const selectedProjectId = data?.project_id ?? payload.project_id ?? activeProject ?? projectId.toString();
    await updateModuleDetails(workspaceSlug.toString(), selectedProjectId, data.id, payload)
      .then((_res) => {
        if (currentSession.current !== requestSession || !currentSession.current.isOpen) return;
        handleClose();

        setToast({
          type: "success",
          title: t("toast.success"),
          message: t("web.module_updated_successfully"),
        });
        return undefined;
      })
      .catch((err) => {
        if (currentSession.current !== requestSession || !currentSession.current.isOpen) return;
        setToast({
          type: "error",
          title: t("toast.error"),
          message: err?.detail ?? err?.error ?? t("web.module_could_not_be_updated_please_try_again"),
        });
      });
  };

  const handleFormSubmit = async (formData: Partial<IModule>) => {
    if (!workspaceSlug || !projectId) return;

    const payload: Partial<IModule> = {
      ...formData,
    };
    if (!data) await handleCreateModule(payload);
    else await handleUpdateModule(payload);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      disablePointerDismissal
    >
      {/* ModuleForm renders its own visible heading; the dialog carries the same text as its name. */}
      <DialogContent
        data-module-dialog=""
        {...getDialogInitialFocusProps("[data-module-dialog] input[name=name]")}
        size="md"
        aria-label={translate("web.runtime.module_dialog_title", { mode: data ? "update" : "create" })}
      >
        <ModuleForm
          key={`${session.identity}/${session.generation}`}
          handleFormSubmit={handleFormSubmit}
          handleClose={handleClose}
          status={!!data}
          projectId={activeProject ?? workspaceProjectIds?.[0] ?? ""}
          setActiveProject={setActiveProject}
          data={data}
          isMobile={isMobile}
        />
      </DialogContent>
    </Dialog>
  );
});
