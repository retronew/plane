/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { mutate } from "swr";
// types
import { setToast } from "@plane/blocks/toast";
import type { CycleDateCheckData, ICycle, TCycleTabOptions } from "@plane/types";
// ui
import { Dialog, DialogContent } from "@makeplane/propel/components/dialog";
import { getDialogInitialFocusProps } from "@/helpers/dialog";
// hooks
import { renderFormattedPayloadDate } from "@plane/utils";
import { useCycle } from "@/hooks/store/use-cycle";
import { useProject } from "@/hooks/store/use-project";
import useLocalStorage from "@/hooks/use-local-storage";
import { usePlatformOS } from "@/hooks/use-platform-os";
// services
import { CycleService } from "@/services/cycle.service";
// local imports
import { CycleForm } from "./form";
import { translate } from "@plane/i18n";

type CycleModalProps = {
  isOpen: boolean;
  handleClose: () => void;
  data?: ICycle | null;
  workspaceSlug: string;
  projectId: string;
};

// services
const cycleService = new CycleService();

export function CycleCreateUpdateModal(props: CycleModalProps) {
  const { isOpen, handleClose, data, workspaceSlug, projectId } = props;
  // states
  const [activeProject, setActiveProject] = useState<string | null>(null);
  // store hooks
  const { workspaceProjectIds } = useProject();
  const { createCycle, updateCycleDetails } = useCycle();
  const { isMobile } = usePlatformOS();

  const { setValue: setCycleTab } = useLocalStorage<TCycleTabOptions>("cycle_tab", "active");

  const handleCreateCycle = async (payload: Partial<ICycle>) => {
    if (!workspaceSlug || !projectId) return;

    const selectedProjectId = payload.project_id ?? projectId.toString();
    await createCycle(workspaceSlug, selectedProjectId, payload)
      .then((_res) => {
        // mutate when the current cycle creation is active
        if (payload.start_date && payload.end_date) {
          const currentDate = new Date();
          const cycleStartDate = new Date(payload.start_date);
          const cycleEndDate = new Date(payload.end_date);
          if (currentDate >= cycleStartDate && currentDate <= cycleEndDate) {
            mutate(`PROJECT_ACTIVE_CYCLE_${selectedProjectId}`);
          }
        }

        setToast({
          type: "success",
          title: translate("toast.success"),
          message: translate("web.cycle_created_successfully"),
        });
        return undefined;
      })
      .catch((err) => {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: err?.detail ?? translate("web.error_in_creating_cycle_please_try_again"),
        });
      });
  };

  const handleUpdateCycle = async (cycleId: string, payload: Partial<ICycle>) => {
    if (!workspaceSlug || !projectId) return;

    const selectedProjectId = payload.project_id ?? projectId.toString();
    await updateCycleDetails(workspaceSlug, selectedProjectId, cycleId, payload)
      .then((_res) => {
        setToast({
          type: "success",
          title: translate("toast.success"),
          message: translate("web.cycle_updated_successfully"),
        });
        return undefined;
      })
      .catch((err) => {
        setToast({
          type: "error",
          title: translate("toast.error"),
          message: err?.detail ?? translate("web.error_in_updating_cycle_please_try_again"),
        });
      });
  };

  const dateChecker = async (cycleProjectId: string, payload: CycleDateCheckData) => {
    let status = false;

    await cycleService.cycleDateCheck(workspaceSlug, cycleProjectId, payload).then((res) => {
      status = res.status;
      return undefined;
    });

    return status;
  };

  const handleFormSubmit = async (formData: Partial<ICycle>) => {
    if (!workspaceSlug || !projectId) return;

    const payload: Partial<ICycle> = {
      ...formData,
      start_date: renderFormattedPayloadDate(formData.start_date) ?? null,
      end_date: renderFormattedPayloadDate(formData.end_date) ?? null,
    };

    let isDateValid: boolean = true;

    if (payload.start_date && payload.end_date) {
      if (data?.id) {
        // Update existing cycle - only check dates if they've changed
        const originalStartDate = renderFormattedPayloadDate(data.start_date) ?? null;
        const originalEndDate = renderFormattedPayloadDate(data.end_date) ?? null;
        const hasDateChanged = payload.start_date !== originalStartDate || payload.end_date !== originalEndDate;

        if (hasDateChanged) {
          isDateValid = await dateChecker(projectId, {
            start_date: payload.start_date,
            end_date: payload.end_date,
            cycle_id: data.id,
          });
        }
      } else {
        // Create new cycle - always check dates
        isDateValid = await dateChecker(projectId, {
          start_date: payload.start_date,
          end_date: payload.end_date,
        });
      }
    }

    if (isDateValid) {
      if (data?.id) await handleUpdateCycle(data.id, payload);
      else {
        await handleCreateCycle(payload).then(() => {
          setCycleTab("all");
          return undefined;
        });
      }
      handleClose();
    } else
      setToast({
        type: "error",
        title: translate("toast.error"),
        message: translate("web.you_already_have_a_cycle_on_the_given_dates_if_you_want_to_c"),
      });
  };

  // Synchronize the selected project before rendering the form, without an effect render.
  if (!isOpen && activeProject !== null) {
    setActiveProject(null);
  } else if (isOpen && data?.project_id && activeProject !== data.project_id) {
    setActiveProject(data.project_id);
  } else if (isOpen && !data?.project_id && !activeProject && workspaceProjectIds?.length) {
    setActiveProject(projectId ?? workspaceProjectIds[0] ?? null);
  }

  return (
    <Dialog
      open={isOpen}
      // The legacy modal shell had no `handleClose`, so an outside press never dismissed it and
      // Escape came from `useKeypress`; Base UI's own Escape now reaches the same handler.
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        data-cycle-dialog=""
        {...getDialogInitialFocusProps("[data-cycle-dialog] input[name=name]")}
        size="md"
      >
        <CycleForm
          handleFormSubmit={handleFormSubmit}
          handleClose={handleClose}
          status={!!data}
          projectId={activeProject ?? ""}
          setActiveProject={setActiveProject}
          data={data}
          isMobile={isMobile}
        />
      </DialogContent>
    </Dialog>
  );
}
