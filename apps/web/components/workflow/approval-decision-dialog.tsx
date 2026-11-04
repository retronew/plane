import { ConfirmDialog } from "@plane/blocks/dialog";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowApproval } from "@plane/types";

export type TApprovalDecisionConfirmation = {
  approvalId: string;
  version: number;
  transitionId: string;
  outcome: "approve" | "reject";
};

export function ApprovalDecisionDialog({
  confirmation,
  pending,
  workflow,
  issueName,
  busy,
  disabled,
  onClose,
  onSubmit,
  note,
  onNoteChange,
}: {
  confirmation: TApprovalDecisionConfirmation | null;
  pending: TWorkflowApproval | null | undefined;
  workflow: TProjectWorkflow | undefined;
  issueName: string;
  busy: boolean;
  disabled: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  const { t } = useTranslation();
  const branch = pending?.branches.find((item) => item.id === confirmation?.transitionId);
  const reject = confirmation?.outcome === "reject";
  const targetId = reject ? branch?.reject_state_id : branch?.destination_id;
  const state = workflow?.states.find((item) => item.id === targetId)?.name ?? targetId ?? "";
  const title = t(reject ? "web.workflow_ui.confirm_reject" : "web.workflow_ui.confirm_approve");
  const isCurrent =
    !!confirmation && !!pending && confirmation.approvalId === pending.id && confirmation.version === pending.version;

  return (
    <ConfirmDialog
      isOpen={isCurrent}
      handleClose={onClose}
      handleSubmit={onSubmit}
      isSubmitting={busy}
      isDisabled={disabled || !pending?.can_decide}
      variant={reject ? "danger" : "warning"}
      title={title}
      content={t(
        reject ? "web.workflow_ui.confirm_reject_description" : "web.workflow_ui.confirm_approve_description",
        { name: issueName, state }
      )}
      primaryButtonText={{ default: title, loading: t("web.workflow_ui.submitting_decision") }}
    >
      <label className="mt-4 block space-y-2 text-body-xs-regular text-secondary">
        <span>{t("web.workflow_ui.approval_note_optional")}</span>
        <TextAreaGroup resize="none" render={<div className="h-24 rounded-xl!" />}>
          <TextArea
            size="lg"
            surface="field"
            aria-label={t("web.workflow_ui.approval_note_optional")}
            placeholder={t("web.workflow_ui.approval_note_placeholder")}
            value={note}
            maxLength={2000}
            disabled={busy}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </TextAreaGroup>
        <span className="block text-right text-caption-md-regular text-tertiary">{note.length}/2000</span>
      </label>
    </ConfirmDialog>
  );
}
