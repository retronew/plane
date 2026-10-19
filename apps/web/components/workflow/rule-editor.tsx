import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import {
  Drawer,
  DrawerPanel,
  DrawerHeader,
  DrawerHeaderContent,
  DrawerHeaderActions,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
} from "@makeplane/propel/components/drawer";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowTransition } from "@plane/types";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { WorkflowRulePreview } from "./rule-cell";
import { WorkflowStepsEditor } from "./steps-editor";

export type DraftRule = Omit<TWorkflowTransition, "id"> & { id?: string };

type Translate = ReturnType<typeof useTranslation>["t"];
type RuleKind = "transition" | "approval";

function getSameSourceRules(workflow: TProjectWorkflow, draft: DraftRule | null) {
  return workflow.transitions.filter((rule) => rule.source_id === draft?.source_id && rule.id !== draft?.id);
}

function getCanSave(draft: DraftRule | null, approval: boolean) {
  if (!draft?.destination_id) return false;
  if (!approval) return true;
  if (!draft.reject_state_id) return false;
  return draft.approver_mode !== "explicit" || Boolean(draft.approver_ids?.length);
}

function getSourceStateName(workflow: TProjectWorkflow, draft: DraftRule) {
  return workflow.states.find((state) => state.id === draft.source_id)?.name;
}

function setStepOutcomes(steps: DraftRule["steps"] | undefined, kind: RuleKind) {
  return (steps ?? []).map((step) =>
    Object.assign({}, step, {
      outcome: kind === "approval" ? ("approve" as const) : ("transition" as const),
    })
  );
}

function FlowTypeSelect({
  draft,
  hasSameSourceRule,
  busy,
  onChange,
  t,
}: {
  draft: DraftRule;
  hasSameSourceRule: boolean;
  busy: boolean;
  onChange: (draft: DraftRule) => void;
  t: Translate;
}) {
  return (
    <>
      <label className="block space-y-2 text-body-xs-medium">
        <span>{t("web.workflow_ui.flow_type")}</span>
        <select
          className="w-full rounded-md border border-subtle bg-layer-1 p-2 text-body-xs-regular"
          aria-label={t("web.workflow_ui.flow_type")}
          disabled={busy || hasSameSourceRule}
          value={draft.kind ?? "transition"}
          onChange={(event) => {
            const kind = event.target.value as RuleKind;
            onChange({
              ...draft,
              kind,
              steps: setStepOutcomes(draft.steps, kind),
            });
          }}
        >
          <option value="transition">{t("web.workflow_ui.transition")}</option>
          <option value="approval">{t("web.workflow_ui.approval")}</option>
        </select>
      </label>
      {hasSameSourceRule && (
        <p className="text-caption-md-regular text-tertiary">{t("web.workflow_ui.same_source_kind")}</p>
      )}
    </>
  );
}

function DestinationSelect({
  label,
  value,
  projectId,
  allowedStates,
  sourceId,
  disabled,
  onChange,
  t,
}: {
  label: string;
  value: string | null | undefined;
  projectId: string;
  allowedStates: string[];
  sourceId: string;
  disabled: boolean;
  onChange: (value: string) => void;
  t: Translate;
}) {
  return (
    <div className="space-y-2">
      <p className="text-body-xs-medium">{label}</p>
      <StateSelect
        projectId={projectId}
        value={value}
        onChange={onChange}
        variant="select-md"
        bypassWorkflow
        allowedStates={allowedStates}
        excludeStateIds={[sourceId]}
        disabled={disabled}
        placeholder={t("web.workflow_ui.select_destination")}
      />
    </div>
  );
}

function ApproverFields({
  draft,
  projectId,
  approval,
  busy,
  onChange,
  t,
}: {
  draft: DraftRule;
  projectId: string;
  approval: boolean;
  busy: boolean;
  onChange: (draft: DraftRule) => void;
  t: Translate;
}) {
  const usesExplicitApprovers = !approval || draft.approver_mode === "explicit";

  return (
    <div className="space-y-2">
      <p className="text-body-xs-medium">{t(approval ? "web.workflow_ui.approvers" : "web.workflow_ui.by")}</p>
      {approval && (
        <label className="flex items-center gap-2 text-body-xs-regular">
          <input
            type="checkbox"
            checked={draft.approver_mode !== "explicit"}
            disabled={busy}
            onChange={(event) =>
              onChange({
                ...draft,
                approver_mode: event.target.checked ? "all" : "explicit",
                approver_ids: [],
              })
            }
          />
          {t("web.workflow_ui.all_members")}
        </label>
      )}
      {usesExplicitApprovers && (
        <MemberSelect
          projectId={projectId}
          multiple
          value={approval ? (draft.approver_ids ?? []) : draft.member_ids}
          onChange={(ids) => onChange(approval ? { ...draft, approver_ids: ids } : { ...draft, member_ids: ids })}
          variant="select-md"
          disabled={busy}
          placeholder={t("web.workflow_ui.all_members")}
        />
      )}
      <p className="text-caption-md-regular text-tertiary">
        {t(approval ? "web.workflow_ui.approvers_hint" : "web.workflow_ui.members_hint")}
      </p>
    </div>
  );
}

function DraftRuleForm({
  draft,
  workflow,
  sameSourceRules,
  projectId,
  workspaceSlug,
  busy,
  approval,
  onChange,
  t,
}: {
  draft: DraftRule;
  workflow: TProjectWorkflow;
  sameSourceRules: TProjectWorkflow["transitions"];
  projectId: string;
  workspaceSlug: string;
  busy: boolean;
  approval: boolean;
  onChange: (draft: DraftRule) => void;
  t: Translate;
}) {
  const allowedStates = workflow.states.map((state) => state.id);

  return (
    <div className="space-y-5 text-primary">
      <p className="text-body-xs-medium">{getSourceStateName(workflow, draft)}</p>
      <WorkflowRulePreview rule={draft} workflow={workflow} />
      <FlowTypeSelect
        draft={draft}
        hasSameSourceRule={sameSourceRules.length > 0}
        busy={busy}
        onChange={onChange}
        t={t}
      />
      <DestinationSelect
        label={t(approval ? "web.workflow_ui.approve_to" : "workflows.workflow_states.state_changes.move_to")}
        value={draft.destination_id}
        projectId={projectId}
        allowedStates={allowedStates}
        sourceId={draft.source_id}
        disabled={busy}
        onChange={(destination_id) => onChange({ ...draft, destination_id })}
        t={t}
      />
      {approval && (
        <DestinationSelect
          label={t("web.workflow_ui.reject_to")}
          value={draft.reject_state_id}
          projectId={projectId}
          allowedStates={allowedStates}
          sourceId={draft.source_id}
          disabled={busy}
          onChange={(reject_state_id) => onChange({ ...draft, reject_state_id })}
          t={t}
        />
      )}
      <ApproverFields draft={draft} projectId={projectId} approval={approval} busy={busy} onChange={onChange} t={t} />
      <WorkflowStepsEditor
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        value={draft.steps ?? []}
        onChange={(steps) => onChange({ ...draft, steps })}
        approval={approval}
        disabled={busy}
      />
    </div>
  );
}

export function WorkflowRuleEditor({
  draft: currentDraft,
  onChange,
  onSave,
  workflow,
  projectId,
  workspaceSlug,
  busy,
}: {
  draft: DraftRule | null;
  onChange: (draft: DraftRule | null) => void;
  onSave: (keepOpen: boolean) => Promise<void>;
  workflow: TProjectWorkflow;
  projectId: string;
  workspaceSlug: string;
  busy: boolean;
}) {
  const { t } = useTranslation();
  // Keep the edited form in the panel until Base UI finishes its exit transition.
  const [lastDraft, setLastDraft] = useState(currentDraft);
  if (currentDraft && currentDraft !== lastDraft) setLastDraft(currentDraft);
  const draft = currentDraft ?? lastDraft;
  const approval = draft?.kind === "approval";
  const sameSourceRules = getSameSourceRules(workflow, draft);
  const canSave = getCanSave(draft, approval);
  return (
    <Drawer
      open={!!currentDraft}
      onOpenChangeComplete={(open) => {
        if (!open) setLastDraft(null);
      }}
      onOpenChange={(open) => {
        if (!open && !busy) onChange(null);
      }}
      swipeDirection="right"
    >
      <DrawerPanel side="end" size="sm" variant="overlay">
        <DrawerHeader>
          <DrawerHeaderContent>
            <DrawerTitle>{t("web.workflow_ui.configure")}</DrawerTitle>
          </DrawerHeaderContent>
          <DrawerHeaderActions side="end">
            <IconButton
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={t("close")}
              icon={<X className="size-4" />}
              onClick={() => onChange(null)}
            />
          </DrawerHeaderActions>
        </DrawerHeader>
        <DrawerBody>
          {draft && (
            <DraftRuleForm
              draft={draft}
              workflow={workflow}
              sameSourceRules={sameSourceRules}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              busy={busy}
              approval={approval}
              onChange={onChange}
              t={t}
            />
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button
            stretch="auto"
            variant="ghost"
            size="md"
            disabled={busy}
            onClick={() => onChange(null)}
            label={t("discard")}
          />
          <Button
            stretch="auto"
            variant="secondary"
            size="md"
            disabled={busy || !canSave}
            onClick={() => void onSave(true)}
            label={t("web.workflow_ui.save_continue")}
          />
          <Button
            stretch="auto"
            variant="primary"
            size="md"
            disabled={busy || !canSave}
            onClick={() => void onSave(false)}
            label={t(busy ? "saving" : "save")}
          />
        </DrawerFooter>
      </DrawerPanel>
    </Drawer>
  );
}
