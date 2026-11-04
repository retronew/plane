// oxlint-disable-next-line import/no-unassigned-import -- Native details open and close transitions.
import "./approval-history.css";
import { observer } from "mobx-react";
import { ArrowRight, Check, Clock3, History, Undo2, X } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowApproval } from "@plane/types";
import { cn, getDateTimeFormatter } from "@plane/utils";
import { ApprovalMemberLink } from "./approval-member-link";
import { useMember } from "@/hooks/store/use-member";

export const ApprovalHistory = observer(function ApprovalHistory({
  workspaceSlug,
  results,
  pendingId,
  workflow,
}: {
  workspaceSlug: string;
  results: TWorkflowApproval[];
  pendingId?: string;
  workflow: TProjectWorkflow | undefined;
}) {
  const { t } = useTranslation();
  const { getUserDetails } = useMember();
  const history = results.filter((approval) => approval.id !== pendingId);
  if (!history.length) return null;

  return (
    <details open className="approval-history group/history border-t border-subtle">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-body-xs-medium text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong [&::-webkit-details-marker]:hidden">
        <History className="size-3.5" aria-hidden="true" />
        {t("web.workflow_ui.approval_history")}
        <span className="rounded-sm bg-layer-2 px-1.5 text-caption-md-medium text-tertiary">{history.length}</span>
        <span
          className="ml-auto text-caption-md-regular text-tertiary group-open/history:rotate-90 motion-safe:transition-transform motion-safe:duration-200"
          aria-hidden="true"
        >
          ›
        </span>
      </summary>
      <ol className="space-y-3 px-3 pb-3">
        {history.map((approval) => {
          const decision = approval.decision;
          const branch = approval.branches.find((item) => item.id === decision?.transition_id);
          const withdrawal = approval.withdrawal;
          const actorId = withdrawal?.actor_id ?? decision?.actor_id;
          const member = actorId ? getUserDetails(actorId) : undefined;
          const snapshot = (
            decision ? branch?.approvers : approval.branches.flatMap((item) => item.approvers ?? [])
          )?.find((person) => person.id === actorId);
          const actorName =
            member?.display_name || withdrawal?.actor_name || snapshot?.name || t("common.unknown_user");
          const approved = decision?.outcome === "approve";
          const Icon = withdrawal ? Undo2 : decision ? (approved ? Check : X) : Clock3;
          const targetId =
            withdrawal?.previous_state_id ??
            (decision ? (approved ? branch?.destination_id : branch?.reject_state_id) : undefined);
          const source = workflow?.states.find((state) => state.id === approval.source_id);
          const target = workflow?.states.find((state) => state.id === targetId);
          const timestamp = withdrawal?.at ?? decision?.at ?? approval.created_at;

          return (
            <li key={approval.id} className="flex gap-2.5 rounded-xl border border-subtle bg-layer-2 p-3">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  decision
                    ? approved
                      ? "bg-success-subtle text-success-primary"
                      : "bg-danger-subtle text-danger-primary"
                    : "bg-layer-1 text-tertiary"
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-body-xs-medium text-primary">
                    {t(withdrawal ? "web.workflow_ui.withdrawn" : `web.workflow_ui.approval_status.${approval.status}`)}
                  </span>
                  <time className="text-caption-md-regular text-tertiary" dateTime={timestamp}>
                    {getDateTimeFormatter({ dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp))}
                  </time>
                </div>
                {actorId ? (
                  <ApprovalMemberLink
                    workspaceSlug={workspaceSlug}
                    memberId={actorId}
                    name={actorName}
                    label={t("web.workflow_ui.decision_by", { name: actorName })}
                  />
                ) : (
                  <p className="text-caption-md-regular text-tertiary">{t("web.workflow_ui.no_decision_record")}</p>
                )}
                {decision?.note && (
                  <p className="rounded-sm border-l-2 border-subtle pl-2 text-caption-md-regular break-words whitespace-pre-wrap text-secondary">
                    {decision.note}
                  </p>
                )}
                {target && (
                  <p className="flex flex-wrap items-center gap-1.5 text-caption-md-regular text-secondary">
                    {source && (
                      <>
                        <span>{source.name}</span>
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </>
                    )}
                    <span className="font-medium text-primary">{target.name}</span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
});
