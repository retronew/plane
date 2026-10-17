import { useState } from "react";
import { Button } from "@makeplane/propel/components/button";
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
import type { TWorkflowImpact, TWorkflowImpactRequest } from "@plane/types";
import { setToast } from "@plane/blocks/toast";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { getWorkflowErrorCode } from "@/helpers/workflow";

export function WorkflowImpactDialog({
  request,
  impact,
  projectId,
  workspaceSlug,
  onClose,
  onApplied,
}: {
  request: TWorkflowImpactRequest;
  impact: TWorkflowImpact;
  projectId: string;
  workspaceSlug: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const [preview, setPreview] = useState(impact),
    [mapping, setMapping] = useState(impact.state_mapping ?? {}),
    [busy, setBusy] = useState(false),
    [changed, setChanged] = useState(false);
  const workflow = store.lists[projectId]?.results.find(
    (item) => (item.workflow_id ?? item.id) === request.workflow_id
  );
  const targetStates =
    request.operation === "states"
      ? request.state_ids
      : request.operation === "delete" || request.operation === "remove_type"
        ? store.lists[projectId]?.results.find((item) => item.is_default)?.states.map((state) => state.id)
        : workflow?.states.map((state) => state.id);
  const submit = async () => {
    setBusy(true);
    try {
      const payload = { ...request, state_mapping: mapping };
      if (changed) {
        setPreview(await store.service.preview(workspaceSlug, projectId, payload));
        setChanged(false);
      } else {
        await store.service.apply(workspaceSlug, projectId, { ...payload, token: preview.token });
        await store.refresh(workspaceSlug, projectId);
        onApplied();
      }
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
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("web.workflow_ui.impact_title")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 text-body-xs-regular text-primary">
              <p>{t("web.workflow_ui.impact_count", { count: preview.affected_count })}</p>
              <p>{t("web.workflow_ui.impact_approvals", { count: preview.invalidated_approval_count })}</p>
              <p className="text-secondary">{t("web.workflow_ui.migration_hint")}</p>
              {preview.examples.map((example) => (
                <p key={example.id} className="truncate text-secondary">
                  {example.name}
                </p>
              ))}
              {preview.required_state_ids.map((stateId) => (
                <div key={stateId} className="space-y-2">
                  <p>
                    {t("web.workflow_ui.map_state", {
                      state:
                        store.lists[projectId]?.results
                          .flatMap((item) => item.states)
                          .find((state) => state.id === stateId)?.name ?? stateId,
                    })}
                  </p>
                  <StateSelect
                    projectId={projectId}
                    value={mapping[stateId]}
                    bypassWorkflow
                    allowedStates={targetStates}
                    variant="select-md"
                    onChange={(id) => {
                      setMapping({ ...mapping, [stateId]: id });
                      setChanged(true);
                    }}
                    disabled={busy}
                  />
                </div>
              ))}
              {!!preview.warnings.length && <p className="text-secondary">{t("web.workflow_ui.impact_warning")}</p>}
            </div>
          </DialogBody>
          <DialogActions>
            <Button stretch="auto" variant="ghost" size="md" disabled={busy} label={t("cancel")} onClick={onClose} />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              disabled={busy || preview.required_state_ids.some((id) => !mapping[id])}
              label={t(changed ? "web.workflow_ui.refresh_preview" : "confirm")}
              onClick={() => void submit()}
            />
          </DialogActions>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}
