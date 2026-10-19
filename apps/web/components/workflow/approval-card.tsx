import { useState } from "react";
import useSWR from "swr";
import { observer } from "mobx-react";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowApproval, TWorkflowTransition } from "@plane/types";
import { getDateTimeFormatter } from "@plane/utils";
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
    <h4 className="flex items-center gap-2 text-body-sm-medium text-primary">
      <ShieldCheck className="size-4" />
      {t(pending ? "web.workflow_ui.pending_approval" : "web.workflow_ui.approval_history")}
    </h4>
  );
}

function ApprovalBranch({
  branch,
  workflow,
  canDecide,
  busy,
  disabled,
  currentUserId,
  onDecide,
}: {
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
  const approverNames = branch.approvers?.map((member) => member.name).join(", ");

  return (
    <div className="space-y-2 rounded-md border border-subtle bg-layer-2 p-3">
      <p className="text-body-xs-medium text-primary">
        {t("web.workflow_ui.approve_to")}
        {": "}
        {workflow?.states.find((state) => state.id === branch.destination_id)?.name ?? branch.destination_id}
      </p>
      <p className="text-body-xs-regular text-secondary">
        {t("web.workflow_ui.reject_to")}
        {": "}
        {workflow?.states.find((state) => state.id === branch.reject_state_id)?.name ?? branch.reject_state_id}
      </p>
      <p className="text-caption-md-regular text-secondary">
        {t("web.workflow_ui.approvers")}
        {": "}
        {approverNames || t("web.workflow_ui.snapshot_missing")}
      </p>
      <div className="flex flex-wrap gap-2">
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
  );
}

function ApprovalBranches({
  pending,
  workflow,
  busy,
  disabled,
  currentUserId,
  onDecide,
}: {
  pending: TWorkflowApproval;
  workflow: TProjectWorkflow | undefined;
  busy: boolean;
  disabled: boolean;
  currentUserId?: string;
  onDecide: (transitionId: string, outcome: "approve" | "reject") => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <p className="text-body-xs-regular text-secondary">{t("web.workflow_ui.approval_hint")}</p>
      {pending.branches.map((branch) => (
        <ApprovalBranch
          key={branch.id}
          branch={branch}
          workflow={workflow}
          canDecide={pending.can_decide}
          busy={busy}
          disabled={disabled}
          currentUserId={currentUserId}
          onDecide={onDecide}
        />
      ))}
    </>
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
    <Button
      stretch="auto"
      variant="secondary"
      size="sm"
      disabled={busy}
      label={t("web.workflow_ui.reapply")}
      onClick={onReapply}
    />
  );
}

function ApprovalHistory({ results, pendingId }: { results: TWorkflowApproval[]; pendingId?: string }) {
  const { t } = useTranslation();

  return (
    <details>
      <summary className="cursor-pointer text-body-xs-medium text-secondary">
        {t("web.workflow_ui.approval_history")}
      </summary>
      <div className="mt-3 space-y-2">
        {results
          .filter((approval) => approval.id !== pendingId)
          .map((approval) => (
            <div key={approval.id} className="text-caption-md-regular text-secondary">
              <p>
                {t(`web.workflow_ui.approval_status.${approval.status}`)}
                {approval.decision && (
                  <span>
                    {" · "}
                    {t(approval.decision.outcome === "approve" ? "web.workflow_ui.approve" : "web.workflow_ui.reject")}
                  </span>
                )}
              </p>
              <time dateTime={approval.decision?.at ?? approval.created_at}>
                {getDateTimeFormatter({ dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(approval.decision?.at ?? approval.created_at)
                )}
              </time>
            </div>
          ))}
      </div>
    </details>
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
  const [keys] = useState(() => new Map<string, string>());
  const pending = data?.pending;
  const act = async (operation: () => Promise<unknown>) => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await operation();
      await Promise.all([mutate(), fetchIssue(workspaceSlug, projectId, issueId)]);
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
    } finally {
      setBusy(false);
    }
  };
  const decide = (transitionId: string, outcome: "approve" | "reject") => {
    if (!pending || !pending.can_decide) return;
    const key = `${pending.id}:${transitionId}:${outcome}`;
    if (!keys.has(key)) keys.set(key, crypto.randomUUID());
    void act(() =>
      store.service.decide(workspaceSlug, projectId, issueId, pending.id, {
        transition_id: transitionId,
        outcome,
        version: pending.version,
        idempotency_key: keys.get(key)!,
      })
    );
  };
  if (!relevant) return null;
  if (loadError) return <ApprovalLoadError onRetry={() => void mutate()} />;
  if (!data) return <output className="text-caption-md-regular text-tertiary">{t("loading")}</output>;
  const currentSource = hasApprovalSource(workflow, issue?.state_id);
  if (!shouldRenderApproval(pending, data.results.length, currentSource)) return null;
  return (
    <section
      className="space-y-3 rounded-lg border border-subtle bg-layer-1 p-4"
      aria-label={t("web.workflow_ui.approval")}
    >
      <ApprovalHeading pending={!!pending} />
      {pending && (
        <ApprovalBranches
          pending={pending}
          workflow={workflow}
          busy={busy}
          disabled={disabled}
          currentUserId={currentUser?.id}
          onDecide={decide}
        />
      )}
      <ApprovalReapply
        pending={pending}
        hasSource={currentSource}
        disabled={disabled}
        busy={busy}
        onReapply={() => void act(() => store.service.reapply(workspaceSlug, projectId, issueId))}
      />
      {!!data.results.length && <ApprovalHistory results={data.results} pendingId={pending?.id} />}
    </section>
  );
});
