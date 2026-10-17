import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Radio, RadioGroup } from "@makeplane/propel/components/radio";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { ICycle, TCycleCompleteRequest } from "@plane/types";
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

function getIncompleteCount(cycle: ICycle | null | undefined): number {
  if (!cycle) return 0;
  const count =
    cycle.total_issues != null
      ? cycle.total_issues - (cycle.completed_issues ?? 0) - (cycle.cancelled_issues ?? 0)
      : (cycle.backlog_issues ?? 0) + (cycle.unstarted_issues ?? 0) + (cycle.started_issues ?? 0);
  return Math.max(0, count);
}

// Keep this component mounted while toggling `open` so Dialog can finish its exit animation.
export const CycleCompleteModal = observer(function CycleCompleteModal({
  workspaceSlug,
  projectId,
  cycleId,
  open,
  onClose,
}: CycleCompleteModalProps) {
  const { t } = useTranslation();
  const { getCycleById, completeCycle } = useCycle();
  const cycle = getCycleById(cycleId);
  const incompleteCount = getIncompleteCount(cycle);
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
              <DialogDescription>
                {t(
                  incompleteCount > 0
                    ? "project_cycles.complete.incomplete_count"
                    : "project_cycles.complete.no_incomplete",
                  { count: incompleteCount }
                )}
              </DialogDescription>
            </DialogHeading>
          </DialogHeader>
          {incompleteCount > 0 && (
            <DialogBody>
              <div className="flex flex-col gap-2">
                <RadioGroup
                  name={`cycle-complete-${cycleId}`}
                  aria-label={t("project_cycles.complete.options")}
                  density="compact"
                  value={action}
                  disabled={loading}
                  onValueChange={(value) => setAction(value)}
                >
                  <label className="mb-1 flex cursor-pointer items-start gap-1">
                    <Radio value="keep" />
                    <span className="text-body-xs-regular">{t("project_cycles.complete.keep")}</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-1">
                    <Radio value="transfer" />
                    <span className="text-body-xs-regular">{t("project_cycles.complete.transfer")}</span>
                  </label>
                </RadioGroup>
                {action === "transfer" && (
                  <CycleSelect
                    projectId={projectId}
                    value={targetCycleId}
                    onChange={setTargetCycleId}
                    variant="select-md"
                    status={["upcoming"]}
                    excludeIds={[cycleId]}
                    clearable={false}
                    disabled={loading}
                    placeholder={t("project_cycles.complete.target_placeholder")}
                  />
                )}
              </div>
            </DialogBody>
          )}
        </DialogMain>
        <DialogActions>
          <Button
            stretch="auto"
            size="sm"
            variant="secondary"
            label={t("cancel")}
            disabled={loading}
            onClick={onClose}
          />
          <Button
            stretch="auto"
            size="sm"
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
