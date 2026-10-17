import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { WorkflowsOutline } from "@makeplane/propel/icons";
import { StateGroupIcon } from "@plane/blocks/icons";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowTransition } from "@plane/types";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";

export function RuleCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-caption-md-medium text-secondary">{label}</p>
      <div className="flex min-h-8 items-center gap-2 rounded-md border border-subtle px-3 text-body-xs-regular text-primary">
        {children}
      </div>
    </div>
  );
}

export function WorkflowRulePreview({
  rule,
  workflow,
}: {
  rule: Omit<TWorkflowTransition, "id">;
  workflow: TProjectWorkflow;
}) {
  const { t } = useTranslation();
  const destination = workflow.states.find((state) => state.id === rule.destination_id);
  const rejected = workflow.states.find((state) => state.id === rule.reject_state_id);
  const members = rule.kind === "approval" ? (rule.approver_ids ?? []) : rule.member_ids;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <RuleCell label={t("web.workflow_ui.via")}>
        <WorkflowsOutline className="size-4 shrink-0" />
        {t(rule.kind === "approval" ? "web.workflow_ui.approval" : "web.workflow_ui.transition")}
      </RuleCell>
      <RuleCell
        label={t(
          rule.kind === "approval" ? "web.workflow_ui.approve_to" : "workflows.workflow_states.state_changes.move_to"
        )}
      >
        {destination && <StateGroupIcon stateGroup={destination.group} color={destination.color} className="size-4" />}
        <span className="truncate">{destination?.name || t("web.workflow_ui.select_destination")}</span>
      </RuleCell>
      <RuleCell label={t(rule.kind === "approval" ? "web.workflow_ui.approvers" : "web.workflow_ui.by")}>
        <Users className="size-4 shrink-0" />
        {members.length ? <ButtonAvatars userIds={members} showTooltip={false} /> : t("web.workflow_ui.all_members")}
      </RuleCell>
      {rule.kind === "approval" && (
        <RuleCell label={t("web.workflow_ui.reject_to")}>
          {rejected && <StateGroupIcon stateGroup={rejected.group} color={rejected.color} className="size-4" />}
          <span className="truncate">{rejected?.name || t("web.workflow_ui.select_destination")}</span>
        </RuleCell>
      )}
    </div>
  );
}
