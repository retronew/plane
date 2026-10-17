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
  const sameSourceRules = workflow.transitions.filter(
    (rule) => rule.source_id === draft?.source_id && rule.id !== draft?.id
  );
  const canSave =
    !!draft?.destination_id &&
    (!approval || (!!draft.reject_state_id && (draft.approver_mode !== "explicit" || !!draft.approver_ids?.length)));
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
            <div className="space-y-5 text-primary">
              <p className="text-body-xs-medium">
                {workflow.states.find((state) => state.id === draft.source_id)?.name}
              </p>
              <WorkflowRulePreview rule={draft} workflow={workflow} />
              <label className="block space-y-2 text-body-xs-medium">
                <span>{t("web.workflow_ui.flow_type")}</span>
                <select
                  className="w-full rounded-md border border-subtle bg-layer-1 p-2 text-body-xs-regular"
                  aria-label={t("web.workflow_ui.flow_type")}
                  disabled={busy || sameSourceRules.length > 0}
                  value={draft.kind ?? "transition"}
                  onChange={(event) => {
                    const kind = event.target.value as "transition" | "approval";
                    onChange({
                      ...draft,
                      kind,
                      steps: (draft.steps ?? []).map((step) =>
                        Object.assign({}, step, {
                          outcome: kind === "approval" ? ("approve" as const) : ("transition" as const),
                        })
                      ),
                    });
                  }}
                >
                  <option value="transition">{t("web.workflow_ui.transition")}</option>
                  <option value="approval">{t("web.workflow_ui.approval")}</option>
                </select>
              </label>
              {sameSourceRules.length > 0 && (
                <p className="text-caption-md-regular text-tertiary">{t("web.workflow_ui.same_source_kind")}</p>
              )}
              <div className="space-y-2">
                <p className="text-body-xs-medium">
                  {t(approval ? "web.workflow_ui.approve_to" : "workflows.workflow_states.state_changes.move_to")}
                </p>
                <StateSelect
                  projectId={projectId}
                  value={draft.destination_id}
                  onChange={(destination_id) => onChange({ ...draft, destination_id })}
                  variant="select-md"
                  bypassWorkflow
                  allowedStates={workflow.states.map((state) => state.id)}
                  excludeStateIds={[draft.source_id]}
                  disabled={busy}
                  placeholder={t("web.workflow_ui.select_destination")}
                />
              </div>
              {approval && (
                <div className="space-y-2">
                  <p className="text-body-xs-medium">{t("web.workflow_ui.reject_to")}</p>
                  <StateSelect
                    projectId={projectId}
                    value={draft.reject_state_id}
                    onChange={(reject_state_id) => onChange({ ...draft, reject_state_id })}
                    variant="select-md"
                    bypassWorkflow
                    allowedStates={workflow.states.map((state) => state.id)}
                    excludeStateIds={[draft.source_id]}
                    disabled={busy}
                    placeholder={t("web.workflow_ui.select_destination")}
                  />
                </div>
              )}
              <div className="space-y-2">
                <p className="text-body-xs-medium">
                  {t(approval ? "web.workflow_ui.approvers" : "web.workflow_ui.by")}
                </p>
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
                {(!approval || draft.approver_mode === "explicit") && (
                  <MemberSelect
                    projectId={projectId}
                    multiple
                    value={approval ? (draft.approver_ids ?? []) : draft.member_ids}
                    onChange={(ids) =>
                      onChange(approval ? { ...draft, approver_ids: ids } : { ...draft, member_ids: ids })
                    }
                    variant="select-md"
                    disabled={busy}
                    placeholder={t("web.workflow_ui.all_members")}
                  />
                )}
                <p className="text-caption-md-regular text-tertiary">
                  {t(approval ? "web.workflow_ui.approvers_hint" : "web.workflow_ui.members_hint")}
                </p>
              </div>
              <WorkflowStepsEditor
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                value={draft.steps ?? []}
                onChange={(steps) => onChange({ ...draft, steps })}
                approval={approval}
                disabled={busy}
              />
            </div>
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
