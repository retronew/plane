import { useState } from "react";
import { Check, ChevronRight, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { WorkflowsOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Switch } from "@makeplane/propel/components/switch";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Menu, MenuTrigger, MenuItem, MenuSeparator } from "@makeplane/propel/components/menu";
import { ActionMenuContent } from "@plane/blocks/common";
import { StateGroupIcon } from "@plane/blocks/icons";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow } from "@plane/types";
import { cn, sortStates } from "@plane/utils";
import type { DraftRule } from "./rule-editor";
import { WorkflowRulePreview } from "./rule-cell";

export function WorkflowStateRules({
  workflow,
  draft,
  onEdit,
  onCreation,
  onInitial,
  onDelete,
  busy,
}: {
  workflow: TProjectWorkflow;
  draft: DraftRule | null;
  onEdit: (draft: DraftRule) => void;
  onCreation: (id: string, allow: boolean) => void;
  onInitial: (id: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState<string[]>([]),
    { t } = useTranslation();
  const expandedSet = new Set(expanded);
  return (
    <div className="space-y-3">
      {sortStates(workflow.states).map((state) => {
        const open = expandedSet.has(state.id),
          rules = workflow.transitions.filter((rule) => rule.source_id === state.id),
          initial = state.id === workflow.initial_state_id;
        const preview = draft?.source_id === state.id ? draft : null;
        return (
          <section
            key={state.id}
            className="overflow-hidden rounded-lg border border-subtle"
            data-workflow-state={state.id}
          >
            <div className="flex min-h-10 flex-wrap items-center gap-3 bg-layer-2 px-3 py-2">
              <button
                type="button"
                className="flex min-w-32 flex-1 items-center gap-2 rounded-sm text-left text-body-xs-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                aria-expanded={open}
                aria-controls={`workflow-state-${state.id}`}
                onClick={() => setExpanded((ids) => (open ? ids.filter((id) => id !== state.id) : [...ids, state.id]))}
              >
                <ChevronRight
                  className={cn("size-3 shrink-0 text-tertiary transition-transform duration-200", open && "rotate-90")}
                />
                <StateGroupIcon stateGroup={state.group} color={state.color} className="size-4" />
                <span className="truncate">{state.name}</span>
              </button>
              {rules.length > 0 && (
                <Tooltip label={t("workflows.workflow_states.state_change_count", { count: rules.length })}>
                  <span className="flex items-center gap-1 rounded bg-success-subtle px-1 text-caption-md-medium text-success-primary">
                    <WorkflowsOutline className="size-3" />
                    {rules.length}
                  </span>
                </Tooltip>
              )}
              {initial && (
                <span className="rounded bg-accent-subtle px-1 text-caption-md-medium text-accent-primary">
                  {t("common.default")}
                </span>
              )}
              <Tooltip label={t(initial ? "workflows.workflow_states.default_state" : "web.workflow_ui.creation_hint")}>
                <label className="flex shrink-0 items-center gap-2 text-caption-md-regular text-secondary">
                  <span>{t("workflows.workflow_states.work_item_creation")}</span>
                  <Switch
                    size="md"
                    checked={state.allow_creation}
                    disabled={busy || !workflow.can_manage || initial}
                    aria-label={`${state.name} ${t("workflows.workflow_states.work_item_creation")}`}
                    onCheckedChange={(allow) => onCreation(state.id, allow)}
                  />
                </label>
              </Tooltip>
              {workflow.can_manage && (
                <Menu>
                  <MenuTrigger
                    render={
                      <IconButton
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label={`${state.name} ${t("web.workflow_ui.actions")}`}
                        icon={<Ellipsis className="size-3.5" />}
                      />
                    }
                  />
                  <ActionMenuContent>
                    <MenuItem
                      disabled={initial || busy}
                      icon={<Check className="size-3.5" />}
                      label={t("web.workflow_ui.set_default")}
                      onClick={() => onInitial(state.id)}
                    />
                  </ActionMenuContent>
                </Menu>
              )}
            </div>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
              aria-hidden={!open}
              inert={!open}
            >
              <div className="min-h-0 overflow-hidden" id={`workflow-state-${state.id}`}>
                <div className="space-y-2 bg-layer-1 p-3">
                  {rules.map((rule) => (
                    <div key={rule.id} className="relative rounded-lg bg-layer-2 p-3 pt-9" data-workflow-rule={rule.id}>
                      {workflow.can_manage && (
                        <div className="absolute top-1 right-2">
                          <Menu>
                            <MenuTrigger
                              render={
                                <IconButton
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  aria-label={t("web.workflow_ui.rule_actions", {
                                    source: state.name,
                                    destination:
                                      workflow.states.find((item) => item.id === rule.destination_id)?.name ?? "",
                                  })}
                                  icon={<Ellipsis className="size-3.5" />}
                                />
                              }
                            />
                            <ActionMenuContent>
                              <MenuItem
                                icon={<Pencil className="size-3.5" />}
                                label={t("edit")}
                                onClick={() => onEdit({ ...rule })}
                              />
                              <MenuSeparator />
                              <MenuItem
                                disabled={busy}
                                variant="danger"
                                icon={<Trash2 className="size-3.5" />}
                                label={t("delete")}
                                onClick={() => onDelete(rule.id)}
                              />
                            </ActionMenuContent>
                          </Menu>
                        </div>
                      )}
                      <WorkflowRulePreview rule={preview?.id === rule.id ? preview : rule} workflow={workflow} />
                    </div>
                  ))}
                  {preview && !preview.id && (
                    <div
                      className="rounded-lg border border-accent-strong bg-layer-2 p-3"
                      data-testid="workflow-draft-preview"
                    >
                      <p className="mb-2 text-caption-md-medium text-accent-primary">
                        {t("web.workflow_ui.draft_preview")}
                      </p>
                      <WorkflowRulePreview rule={preview} workflow={workflow} />
                    </div>
                  )}
                  {workflow.can_manage && (
                    <Button
                      stretch="auto"
                      size="sm"
                      variant="ghost"
                      disabled={busy || workflow.states.length < 2}
                      icon={<Plus className="size-3.5" />}
                      onClick={() =>
                        onEdit({
                          source_id: state.id,
                          destination_id: "",
                          member_ids: [],
                          kind: rules[0]?.kind ?? "transition",
                          approver_mode: "all",
                        })
                      }
                      label={t("web.workflow_ui.add_flow")}
                    />
                  )}
                  {!workflow.can_manage && !rules.length && (
                    <p className="text-body-xs-regular text-tertiary">{t("web.workflow_ui.no_rules")}</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
