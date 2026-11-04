import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowApproval } from "@plane/types";

export function ApprovalWithdrawAction({
  pending,
  workflow,
  disabled,
  busy,
  onWithdraw,
}: {
  pending: TWorkflowApproval | null | undefined;
  workflow: TProjectWorkflow | undefined;
  disabled: boolean;
  busy: boolean;
  onWithdraw: (approval: TWorkflowApproval) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [confirmation, setConfirmation] = useState<{ id: string; version: number } | null>(null);
  if (!pending?.can_withdraw || disabled) return null;
  const previousState = workflow?.states.find((state) => state.id === pending.previous_state_id)?.name ?? "";
  const isCurrent = confirmation?.id === pending.id && confirmation.version === pending.version;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle px-3 py-2.5">
        <p className="text-caption-md-regular text-tertiary">{t("web.workflow_ui.withdraw_hint")}</p>
        <Button
          size="sm"
          stretch="auto"
          variant="secondary"
          icon={<Undo2 className="size-3.5" />}
          label={t("web.workflow_ui.withdraw_approval")}
          disabled={busy}
          onClick={() => setConfirmation({ id: pending.id, version: pending.version })}
        />
      </div>
      <ConfirmDialog
        isOpen={isCurrent}
        variant="warning"
        title={t("web.workflow_ui.withdraw_approval")}
        content={t("web.workflow_ui.withdraw_description", { state: previousState })}
        isSubmitting={busy}
        isDisabled={disabled}
        handleClose={() => {
          if (!busy) setConfirmation(null);
        }}
        handleSubmit={async () => {
          if (!isCurrent || busy) return;
          await onWithdraw(pending);
          setConfirmation(null);
        }}
        primaryButtonText={{
          default: t("web.workflow_ui.confirm_withdraw"),
          loading: t("web.workflow_ui.withdrawing"),
        }}
      />
    </>
  );
}
