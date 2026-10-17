import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
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
import { RadioGroupField, RadioGroupFieldOption } from "@makeplane/propel/components/radio-group-field";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TCycleCompleteRequest } from "@plane/types";
import { useCycle } from "@/hooks/store/use-cycle";
import { CycleSelect } from "@/components/dropdowns/cycle/cycle-select";

export type CycleCompleteModalProps = {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
  cycleName: string;
  open: boolean;
  onClose: () => void;
};

// Keep this component mounted while toggling `open` so Dialog can finish its exit animation.
export const CycleCompleteModal = observer(function CycleCompleteModal({
  workspaceSlug,
  projectId,
  cycleId,
  cycleName,
  open,
  onClose,
}: CycleCompleteModalProps) {
  const { t } = useTranslation();
  const { getCycleById, completeCycle } = useCycle();
  const cycle = getCycleById(cycleId);
  const incompleteCount = Math.max(
    0,
    cycle?.total_issues != null
      ? cycle.total_issues - (cycle.completed_issues ?? 0) - (cycle.cancelled_issues ?? 0)
      : (cycle?.backlog_issues ?? 0) + (cycle?.unstarted_issues ?? 0) + (cycle?.started_issues ?? 0)
  );
  const [action, setAction] = useState<TCycleCompleteRequest["incomplete_action"]>("keep");
  const [targetCycleId, setTargetCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const canSubmit =
    cycle?.status?.toLowerCase() === "current" &&
    !cycle.completed_at &&
    !cycle.archived_at &&
    (incompleteCount === 0 || action === "keep" || !!targetCycleId);

  const submit = async () => {
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    const data: TCycleCompleteRequest =
      incompleteCount > 0 && action === "transfer" && targetCycleId
        ? { incomplete_action: "transfer", target_cycle_id: targetCycleId }
        : { incomplete_action: "keep" };
    try {
      await completeCycle(workspaceSlug, projectId, cycleId, data);
      setToast({ type: "success", title: t("project_cycles.complete.success") });
      onClose();
    } catch {
      setToast({ type: "error", title: t("project_cycles.complete.error") });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (!next && submitting.current) details.cancel();
        else if (!next) onClose();
      }}
      onOpenChangeComplete={(next) => {
        if (!next) {
          setAction("keep");
          setTargetCycleId(null);
        }
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("project_cycles.complete.title")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <p className="mb-3 text-13 text-secondary">{cycleName}</p>
            <p className="mb-4 text-13 text-secondary">
              {t("project_cycles.complete.incomplete_count", { count: incompleteCount })}
            </p>
            {incompleteCount > 0 ? (
              <div className="flex flex-col gap-4">
                <RadioGroupField
                  name={`cycle-complete-${cycleId}`}
                  label={t("project_cycles.complete.options")}
                  size="md"
                  density="comfortable"
                  value={action}
                  disabled={loading}
                  onValueChange={(value) => setAction(value)}
                >
                  <RadioGroupFieldOption value="keep" label={t("project_cycles.complete.keep")} />
                  <RadioGroupFieldOption value="transfer" label={t("project_cycles.complete.transfer")} />
                </RadioGroupField>
                {action === "transfer" && (
                  <CycleSelect
                    projectId={projectId}
                    value={targetCycleId}
                    onChange={setTargetCycleId}
                    variant="select-lg"
                    status={["upcoming"]}
                    excludeIds={[cycleId]}
                    clearable={false}
                    disabled={loading}
                    placeholder={t("project_cycles.complete.target_placeholder")}
                  />
                )}
              </div>
            ) : (
              <p className="text-13 text-secondary">{t("project_cycles.complete.no_incomplete")}</p>
            )}
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button
            stretch="auto"
            size="md"
            variant="secondary"
            label={t("cancel")}
            disabled={loading}
            onClick={onClose}
          />
          <Button
            stretch="auto"
            size="md"
            variant="primary"
            label={t("project_cycles.complete.action")}
            loading={loading}
            disabled={loading || !canSubmit}
            onClick={() => void submit()}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
