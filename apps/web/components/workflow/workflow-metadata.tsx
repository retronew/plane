import { useEffect, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TProjectWorkflow, TWorkflowImpactRequest } from "@plane/types";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { useProjectState } from "@/hooks/store/use-project-state";
import { sortStates } from "@plane/utils";
import { getWorkflowErrorCode } from "@/helpers/workflow";

export function WorkflowMetadata({
  open = true,
  onOpenChangeComplete,
  workflow,
  projectId,
  workspaceSlug,
  onClose,
  onPreview,
}: {
  open?: boolean;
  onOpenChangeComplete?: (open: boolean) => void;
  workflow?: TProjectWorkflow;
  projectId: string;
  workspaceSlug: string;
  onClose: () => void;
  onPreview: (request: TWorkflowImpactRequest) => void;
}) {
  const { t } = useTranslation(),
    store = useProjectWorkflow(projectId),
    { getProjectStateIds, getStateById } = useProjectState();
  const [name, setName] = useState(workflow?.name ?? ""),
    [description, setDescription] = useState(workflow?.description ?? ""),
    [states, setStates] = useState(workflow?.states.map((state) => state.id) ?? []),
    [busy, setBusy] = useState(false);
  // A conditionally mounted, initially open Base UI root skips its enter transition.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Synchronize Base UI's external transition lifecycle: the root must commit closed before opening.
    // eslint-disable-next-line react/set-state-in-effect
    setMounted(true);
  }, []);
  const allStates = sortStates(
    (getProjectStateIds(projectId) ?? [])
      .map((id) => getStateById(id))
      .filter((state): state is NonNullable<typeof state> => !!state)
  );
  const save = async () => {
    setBusy(true);
    try {
      if (workflow) {
        const updated = await store.service.update(
          workspaceSlug,
          projectId,
          { name, description, version: workflow.version },
          workflow.workflow_id ?? workflow.id
        );
        store.set(projectId, updated);
        const previous = workflow.states.map((state) => state.id);
        if (
          !workflow.is_default &&
          (previous.length !== states.length || previous.some((id) => !states.includes(id)))
        ) {
          onPreview({ operation: "states", workflow_id: workflow.workflow_id ?? workflow.id, state_ids: states });
          return;
        }
      } else {
        await store.service.create(workspaceSlug, projectId, {
          name,
          description,
          state_ids: states,
          version: store.lists[projectId]?.policy_version,
        });
        await store.refresh(workspaceSlug, projectId);
      }
      onClose();
    } catch (error) {
      const code = getWorkflowErrorCode(error);
      setToast({
        type: "error",
        title: t("error"),
        message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed"),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={mounted && open}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onClose();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>
                {t(workflow ? "web.workflow_ui.edit_workflow" : "web.workflow_ui.new_workflow")}
              </DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <InputField
                orientation="vertical"
                size="md"
                label={t("name")}
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
              <InputField
                orientation="vertical"
                size="md"
                label={t("description")}
                value={description}
                disabled={busy}
                onChange={(event) => setDescription(event.target.value)}
              />
              {!workflow?.is_default && workflow?.id !== "default" && (
                <fieldset disabled={busy} className="space-y-2">
                  <legend className="mb-2 text-body-xs-medium">{t("web.workflow_ui.columns.states")}</legend>
                  {allStates.map((state) => (
                    <label key={state.id} className="flex items-center gap-2 text-body-xs-regular">
                      <input
                        type="checkbox"
                        checked={states.includes(state.id)}
                        onChange={(event) =>
                          setStates((ids) =>
                            event.target.checked ? [...ids, state.id] : ids.filter((id) => id !== state.id)
                          )
                        }
                      />
                      {state.name}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
          </DialogBody>
          <DialogActions>
            <Button stretch="auto" variant="ghost" size="md" disabled={busy} label={t("cancel")} onClick={onClose} />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              disabled={busy || !name.trim() || (!workflow?.is_default && workflow?.id !== "default" && !states.length)}
              label={t("save")}
              onClick={() => void save()}
            />
          </DialogActions>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}
