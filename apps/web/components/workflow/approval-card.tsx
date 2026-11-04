import { useState } from "react";
import useSWR from "swr";
import { observer } from "mobx-react";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { StateGroupIcon } from "@plane/blocks/icons";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowApproval, TWorkflowTransition } from "@plane/types";
import { ApprovalDecisionDialog } from "./approval-decision-dialog";
import { ApprovalWithdrawAction } from "./approval-withdraw-action";
import type { TApprovalDecisionConfirmation } from "./approval-decision-dialog";
import { ApprovalHistory } from "./approval-history";
import { ApprovalMemberLink } from "./approval-member-link";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { useUser } from "@/hooks/store/user";
import { getWorkflowErrorCode, getWorkflowErrorReason } from "@/helpers/workflow";

function hasApprovalSource(workflow: TProjectWorkflow | undefined, issueStateId?: string | null) {
  return !!(
    workflow?.enabled &&
    workflow.is_active &&
    workflow.transitions.some((rule) => rule.kind === "approval" && rule.source_id === issueStateId)
  );
}

function shouldRenderApproval(pending: TWorkflowApproval | null | undefined, resultCount: number, hasSource: boolean) {
  return !!pending || resultCount > 0 || hasSource;
}

function ApprovalLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-subtle p-3">
      <p className="text-body-xs-regular text-secondary">{t("web.workflow_ui.approval_load_failed")}</p>
      <Button stretch="auto" variant="ghost" size="sm" label={t("common.retry")} onClick={onRetry} />
    </div>
  );
}

function ApprovalHeading({ pending }: { pending: boolean }) {
  const { t } = useTranslation();

  return (
    <header
      className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${pending ? "bg-warning-subtle" : ""}`}
    >
      <h4
        className={`flex items-center gap-2 text-body-xs-medium ${pending ? "text-warning-primary" : "text-primary"}`}
      >
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
        {t("web.workflow_ui.approval")}
      </h4>
      {pending && (
        <span className="rounded-full bg-layer-1 px-2 py-0.5 text-caption-md-medium text-warning-primary">
          {t("web.workflow_ui.pending_approval")}
        </span>
      )}
    </header>
  );
}

function ApprovalDestination({
  label,
  stateId,
  workflow,
}: {
  label: string;
  stateId: string | null | undefined;
  workflow: TProjectWorkflow | undefined;
}) {
  const state = workflow?.states.find((item) => item.id === stateId);

  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-caption-md-regular text-tertiary">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-body-xs-medium text-primary">
        {state && (
          <StateGroupIcon
            stateGroup={state.group}
            color={state.color}
            icon={state.icon}
            className="size-3.5 shrink-0"
          />
        )}
        <span className="break-words">{state?.name ?? stateId}</span>
      </dd>
    </div>
  );
}

function ApprovalBranch({
  workspaceSlug,
  branch,
  workflow,
  canDecide,
  busy,
  disabled,
  currentUserId,
  onDecide,
}: {
  workspaceSlug: string;
  branch: TWorkflowTransition;
  workflow: TProjectWorkflow | undefined;
  canDecide: boolean;
  busy: boolean;
  disabled: boolean;
  currentUserId?: string;
  onDecide: (transitionId: string, outcome: "approve" | "reject") => void;
}) {
  const { t } = useTranslation();
  const blocked = busy || disabled || !canDecide || !branch.approvers?.some((member) => member.id === currentUserId);

  return (
    <div className="overflow-hidden rounded-xl border border-subtle">
      <dl className="grid grid-cols-1 gap-3 bg-layer-2 p-3 @min-[360px]:grid-cols-2">
        <ApprovalDestination
          label={t("web.workflow_ui.approve_to")}
          stateId={branch.destination_id}
          workflow={workflow}
        />
        <ApprovalDestination
          label={t("web.workflow_ui.reject_to")}
          stateId={branch.reject_state_id}
          workflow={workflow}
        />
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle px-3 py-2.5">
        <div className="min-w-0 flex-1 basis-36 space-y-1">
          <p className="text-caption-md-regular text-tertiary">{t("web.workflow_ui.approvers")}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {branch.approvers?.length ? (
              branch.approvers.map((member) => (
                <ApprovalMemberLink
                  key={member.id}
                  workspaceSlug={workspaceSlug}
                  memberId={member.id}
                  name={member.name}
                />
              ))
            ) : (
              <span className="text-caption-md-regular text-secondary">{t("web.workflow_ui.snapshot_missing")}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            stretch="auto"
            variant="primary"
            size="sm"
            icon={<Check className="size-3.5" />}
            disabled={blocked}
            label={t("web.workflow_ui.approve")}
            onClick={() => onDecide(branch.id, "approve")}
          />
          <Button
            stretch="auto"
            variant="secondary"
            size="sm"
            icon={<X className="size-3.5" />}
            disabled={blocked}
            label={t("web.workflow_ui.reject")}
            onClick={() => onDecide(branch.id, "reject")}
          />
        </div>
      </div>
    </div>
  );
}

function ApprovalBranches({
  workspaceSlug,
  pending,
  workflow,
  busy,
  disabled,
  currentUserId,
  onDecide,
}: {
  workspaceSlug: string;
  pending: TWorkflowApproval;
  workflow: TProjectWorkflow | undefined;
  busy: boolean;
  disabled: boolean;
  currentUserId?: string;
  onDecide: (transitionId: string, outcome: "approve" | "reject") => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 border-t border-subtle px-3 py-3">
      <p className="text-caption-md-regular leading-5 text-tertiary">{t("web.workflow_ui.approval_hint")}</p>
      {pending.branches.map((branch) => (
        <ApprovalBranch
          key={branch.id}
          workspaceSlug={workspaceSlug}
          branch={branch}
          workflow={workflow}
          canDecide={pending.can_decide}
          busy={busy}
          disabled={disabled}
          currentUserId={currentUserId}
          onDecide={onDecide}
        />
      ))}
    </div>
  );
}

function ApprovalReapply({
  pending,
  hasSource,
  disabled,
  busy,
  onReapply,
}: {
  pending: TWorkflowApproval | null | undefined;
  hasSource: boolean;
  disabled: boolean;
  busy: boolean;
  onReapply: () => void;
}) {
  const { t } = useTranslation();
  if (pending || !hasSource || disabled) return null;

  return (
    <div className="px-3 py-3">
      <Button
        stretch="auto"
        variant="secondary"
        size="sm"
        disabled={busy}
        label={t("web.workflow_ui.reapply")}
        onClick={onReapply}
      />
    </div>
  );
}

export const WorkflowApprovalCard = observer(function WorkflowApprovalCard({
  workspaceSlug,
  projectId,
  issueId,
  disabled,
}: {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
}) {
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation(),
    {
      issue: { fetchIssue, getIssueById },
    } = useIssueDetail();
  const issue = getIssueById(issueId),
    workflow = store.resolve(projectId, issue?.type_id);
  const { data: currentUser } = useUser();
  const relevant = !!issue;
  const {
    data,
    error: loadError,
    mutate,
  } = useSWR(
    relevant
      ? ["workflow-approvals", workspaceSlug, projectId, issueId, issue?.state_id, issue?.type_id, workflow?.version]
      : null,
    () => store.service.approvals(workspaceSlug, projectId, issueId)
  );
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<TApprovalDecisionConfirmation | null>(null);
  const [note, setNote] = useState("");
  const [keys] = useState(() => new Map<string, string>());
  const pending = data?.pending;
  const act = async (operation: () => Promise<unknown>) => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await operation();
      await Promise.all([mutate(), fetchIssue(workspaceSlug, projectId, issueId)]);
      return true;
    } catch (error) {
      const code = getWorkflowErrorCode(error);
      setToast({
        type: "error",
        title: t("error"),
        message:
          getWorkflowErrorReason(error) ??
          (code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.approval_failed")),
      });
      await mutate();
      return false;
    } finally {
      setBusy(false);
    }
  };
  const decide = (transitionId: string, outcome: "approve" | "reject") => {
    if (!pending || !pending.can_decide) return;
    const key = JSON.stringify([pending.id, transitionId, outcome, note.trim()]);
    if (!keys.has(key)) keys.set(key, crypto.randomUUID());
    return act(() =>
      store.service.decide(workspaceSlug, projectId, issueId, pending.id, {
        transition_id: transitionId,
        outcome,
        version: pending.version,
        idempotency_key: keys.get(key)!,
        note: note.trim(),
      })
    );
  };
  const confirmDecision = async () => {
    if (!confirmation || !pending || busy || disabled) return;
    if (confirmation.approvalId !== pending.id || confirmation.version !== pending.version) {
      setConfirmation(null);
      return;
    }
    const succeeded = await decide(confirmation.transitionId, confirmation.outcome);
    if (succeeded) setNote("");
    setConfirmation(null);
  };
  if (!relevant) return null;
  if (loadError) return <ApprovalLoadError onRetry={() => void mutate()} />;
  if (!data) return null;
  const currentSource = hasApprovalSource(workflow, issue?.state_id);
  if (!shouldRenderApproval(pending, data.results.length, currentSource)) return null;
  return (
    <section
      className={`@container my-4 overflow-hidden rounded-2xl border bg-layer-1 text-body-xs-regular ${pending ? "border-warning-strong" : "border-subtle"}`}
      aria-label={t("web.workflow_ui.approval")}
    >
      <ApprovalHeading pending={!!pending} />
      {pending && (
        <ApprovalBranches
          workspaceSlug={workspaceSlug}
          pending={pending}
          workflow={workflow}
          busy={busy}
          disabled={disabled}
          currentUserId={currentUser?.id}
          onDecide={(transitionId, outcome) => {
            setConfirmation({ approvalId: pending.id, version: pending.version, transitionId, outcome });
          }}
        />
      )}
      <ApprovalWithdrawAction
        pending={pending}
        workflow={workflow}
        disabled={disabled}
        busy={busy}
        onWithdraw={async (approval) => {
          const key = `${approval.id}:withdraw`;
          if (!keys.has(key)) keys.set(key, crypto.randomUUID());
          await act(() =>
            store.service.withdraw(workspaceSlug, projectId, issueId, approval.id, {
              version: approval.version,
              idempotency_key: keys.get(key)!,
            })
          );
        }}
      />
      <ApprovalReapply
        pending={pending}
        hasSource={currentSource}
        disabled={disabled}
        busy={busy}
        onReapply={() => void act(() => store.service.reapply(workspaceSlug, projectId, issueId))}
      />
      {!!data.results.length && (
        <ApprovalHistory
          workspaceSlug={workspaceSlug}
          results={data.results}
          pendingId={pending?.id}
          workflow={workflow}
        />
      )}
      <ApprovalDecisionDialog
        confirmation={confirmation}
        pending={pending}
        workflow={workflow}
        issueName={issue.name}
        busy={busy}
        disabled={disabled}
        onClose={() => {
          if (!busy) {
            setConfirmation(null);
            setNote("");
          }
        }}
        onSubmit={confirmDecision}
        note={note}
        onNoteChange={setNote}
      />
    </section>
  );
});
