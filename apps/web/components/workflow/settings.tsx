import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { observer } from "mobx-react";
import { Link, useParams } from "react-router";
import { Check, ChevronRight, Ellipsis, History, Pause, Pencil, Play, Plus, Trash2, Users, X } from "lucide-react";
import { WorkflowsOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Switch } from "@makeplane/propel/components/switch";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Menu, MenuTrigger, MenuItem, MenuSeparator } from "@makeplane/propel/components/menu";
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
import { ActionMenuContent } from "@plane/blocks/common";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { StateGroupIcon } from "@plane/blocks/icons";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowActivity, TWorkflowTransition } from "@plane/types";
import { cn } from "@plane/utils";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { PageHead } from "@/components/core/page-title";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { getWorkflowErrorCode } from "@/helpers/workflow";

type DraftRule = Omit<TWorkflowTransition, "id"> & { id?: string };

export const WorkflowSettings = observer(function WorkflowSettings({ detail = false }: { detail?: boolean }) {
  const { workspaceSlug = "", projectId = "" } = useParams();
  const store = useProjectWorkflow(projectId);
  const workflow = store.workflows[projectId];
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftRule | null>(null),
    [showHistory, setShowHistory] = useState(false);
  const base = `/${workspaceSlug}/settings/projects/${projectId}/workflows/`;
  const label = t("common.workflows"),
    defaultName = t("web.workflow_ui.default_name");
  const perform = async (operation: () => Promise<TProjectWorkflow>) => {
    if (busy || !workflow?.can_manage) return false;
    setBusy(true);
    try {
      store.set(projectId, await operation());
      return true;
    } catch (error) {
      const code = getWorkflowErrorCode(error);
      setToast({
        type: "error",
        title: t("error"),
        message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed"),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const header = (
    <SettingsPageHeader
      leftItem={
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                href={detail ? base : undefined}
                label={label}
                icon={<WorkflowsOutline className="size-4 text-tertiary" />}
              />
            }
          />
          {detail && (
            <Breadcrumbs.Item
              component={
                <BreadcrumbLink label={defaultName} icon={<WorkflowsOutline className="size-4 text-tertiary" />} />
              }
            />
          )}
        </Breadcrumbs>
      }
    />
  );
  return (
    <SettingsContentWrapper header={header}>
      <PageHead title={`${detail ? defaultName : label} - ${t("settings")}`} />
      <SettingsHeading
        title={detail ? defaultName : label}
        description={t(detail ? "web.workflow_ui.default_description" : "web.workflow_ui.description")}
      />
      {!workflow ? (
        <output className="mt-8 block rounded-lg border border-subtle p-6 text-body-xs-regular text-secondary">
          {store.errors[projectId] ? (
            <>
              <p>{t("web.workflow_ui.load_failed")}</p>
              <Button
                stretch="auto"
                variant="ghost"
                size="md"
                onClick={() => void store.fetch(workspaceSlug, projectId, true).catch(() => undefined)}
                label={t("common.retry")}
              />
            </>
          ) : (
            t("loading")
          )}
        </output>
      ) : (
        <>
          {!detail ? (
            <div className="mt-8 space-y-8">
              <SettingsBoxedControlItem
                title={t("web.workflow_ui.enable")}
                description={t("web.workflow_ui.enable_description")}
                control={
                  <Switch
                    size="md"
                    checked={workflow.enabled}
                    disabled={busy || !workflow.can_manage}
                    aria-label={t("web.workflow_ui.enable")}
                    onCheckedChange={(enabled) =>
                      void perform(() => store.service.update(workspaceSlug, projectId, { enabled }))
                    }
                  />
                }
              />
              {workflow.enabled && (
                <div className="overflow-hidden rounded-lg border border-subtle">
                  <table className="w-full text-left text-body-xs-regular">
                    <thead className="bg-layer-1 text-tertiary">
                      <tr>
                        {["name", "status", "states", "applies_to"].map((key) => (
                          <th key={key} className="px-4 py-2 font-medium">
                            {t(`web.workflow_ui.columns.${key}`)}
                          </th>
                        ))}
                        <th className="w-10">
                          <span className="sr-only">{t("web.workflow_ui.actions")}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-subtle hover:bg-layer-1">
                        <td className="px-4 py-3">
                          <Link
                            to={`${base}default/`}
                            className="flex items-center gap-2 rounded-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                          >
                            <WorkflowsOutline className="size-4 shrink-0 text-tertiary" />
                            {defaultName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-caption-md-medium",
                              workflow.is_active ? "bg-success-subtle text-success-primary" : "bg-layer-1 text-tertiary"
                            )}
                          >
                            {t(workflow.is_active ? "web.workflow_ui.active" : "web.workflow_ui.inactive")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-secondary">{t("web.workflow_ui.all_states")}</td>
                        <td className="px-4 py-3 text-secondary">{t("web.workflow_ui.all_work_items")}</td>
                        <td className="pr-3">
                          <Menu>
                            <MenuTrigger
                              render={
                                <IconButton
                                  size="sm"
                                  variant="ghost"
                                  aria-label={t("web.workflow_ui.actions")}
                                  icon={<Ellipsis className="size-3.5" />}
                                />
                              }
                            />
                            <ActionMenuContent>
                              {workflow.can_manage && (
                                <MenuItem
                                  disabled={busy}
                                  icon={
                                    workflow.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />
                                  }
                                  label={t(
                                    workflow.is_active ? "web.workflow_ui.disable" : "web.workflow_ui.enable_one"
                                  )}
                                  onClick={() =>
                                    void perform(() =>
                                      store.service.update(workspaceSlug, projectId, { is_active: !workflow.is_active })
                                    )
                                  }
                                />
                              )}
                              <MenuItem
                                icon={<History className="size-3.5" />}
                                label={t("workflows.quick_actions.view_change_history")}
                                onClick={() => setShowHistory(true)}
                              />
                            </ActionMenuContent>
                          </Menu>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-body-sm-medium text-primary">{t("project_settings.workflows.detail.define")}</h4>
                <Tooltip label={t("workflows.quick_actions.view_change_history")}>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={<History className="size-3.5" />}
                    aria-label={t("workflows.quick_actions.view_change_history")}
                    onClick={() => setShowHistory(true)}
                  />
                </Tooltip>
              </div>
              {(!workflow.enabled || !workflow.is_active) && (
                <output className="mb-4 block rounded-lg bg-layer-1 px-3 py-2 text-body-xs-regular text-secondary">
                  {t("web.workflow_ui.paused_hint")}
                </output>
              )}
              <div className="space-y-3">
                {workflow.states.map((state) => {
                  const open = expanded.includes(state.id),
                    rules = workflow.transitions.filter((rule) => rule.source_id === state.id);
                  const initial = state.id === workflow.initial_state_id;
                  return (
                    <section
                      key={state.id}
                      className="overflow-hidden rounded-lg border border-subtle"
                      data-workflow-state={state.id}
                    >
                      <div className="flex min-h-10 items-center gap-3 bg-layer-2 px-3 py-2">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left text-body-xs-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                          aria-expanded={open}
                          aria-controls={`workflow-state-${state.id}`}
                          onClick={() =>
                            setExpanded((ids) => (open ? ids.filter((id) => id !== state.id) : [...ids, state.id]))
                          }
                        >
                          <ChevronRight
                            className={cn(
                              "size-3 shrink-0 text-tertiary transition-transform duration-200",
                              open && "rotate-90"
                            )}
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
                        <Tooltip
                          label={t(
                            initial ? "workflows.workflow_states.default_state" : "web.workflow_ui.creation_hint"
                          )}
                        >
                          <label className="flex shrink-0 items-center gap-2 text-caption-md-regular text-secondary">
                            <span>{t("workflows.workflow_states.work_item_creation")}</span>
                            <Switch
                              size="md"
                              checked={state.allow_creation}
                              disabled={busy || !workflow.can_manage || initial}
                              aria-label={`${state.name} ${t("workflows.workflow_states.work_item_creation")}`}
                              onCheckedChange={(allow) =>
                                void perform(() => store.service.setCreation(workspaceSlug, projectId, state.id, allow))
                              }
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
                                onClick={() =>
                                  void perform(() =>
                                    store.service.update(workspaceSlug, projectId, { initial_state_id: state.id })
                                  )
                                }
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
                            {rules.map((rule) => {
                              const destination = workflow.states.find((s) => s.id === rule.destination_id);
                              return (
                                <div
                                  key={rule.id}
                                  className="relative rounded-lg bg-layer-2 p-3"
                                  data-workflow-rule={rule.id}
                                >
                                  <div className="absolute top-1.5 right-2">
                                    {workflow.can_manage && (
                                      <Menu>
                                        <MenuTrigger
                                          render={
                                            <IconButton
                                              size="sm"
                                              variant="ghost"
                                              disabled={busy}
                                              aria-label={t("web.workflow_ui.rule_actions", {
                                                source: state.name,
                                                destination: destination?.name ?? "",
                                              })}
                                              icon={<Ellipsis className="size-3.5" />}
                                            />
                                          }
                                        />
                                        <ActionMenuContent>
                                          <MenuItem
                                            icon={<Pencil className="size-3.5" />}
                                            label={t("edit")}
                                            onClick={() => setDraft({ ...rule })}
                                          />
                                          <MenuSeparator />
                                          <MenuItem
                                            disabled={busy}
                                            variant="danger"
                                            icon={<Trash2 className="size-3.5" />}
                                            label={t("delete")}
                                            onClick={() =>
                                              void perform(() =>
                                                store.service.deleteTransition(workspaceSlug, projectId, rule.id)
                                              )
                                            }
                                          />
                                        </ActionMenuContent>
                                      </Menu>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    <RuleCell label={t("web.workflow_ui.via")}>
                                      <WorkflowsOutline className="size-4 shrink-0" />
                                      {t("web.workflow_ui.transition")}
                                    </RuleCell>
                                    <RuleCell label={t("workflows.workflow_states.state_changes.move_to")}>
                                      {destination && (
                                        <StateGroupIcon
                                          stateGroup={destination.group}
                                          color={destination.color}
                                          className="size-4"
                                        />
                                      )}
                                      <span className="truncate">{destination?.name}</span>
                                    </RuleCell>
                                    <RuleCell label={t("web.workflow_ui.by")}>
                                      <Users className="size-4 shrink-0" />
                                      {rule.member_ids.length ? (
                                        <ButtonAvatars userIds={rule.member_ids} showTooltip={false} />
                                      ) : (
                                        t("web.workflow_ui.all_members")
                                      )}
                                    </RuleCell>
                                  </div>
                                </div>
                              );
                            })}
                            {workflow.can_manage && (
                              <Button
                                stretch="auto"
                                size="sm"
                                variant="ghost"
                                disabled={busy || workflow.states.length < 2}
                                icon={<Plus className="size-3.5" />}
                                onClick={() => setDraft({ source_id: state.id, destination_id: "", member_ids: [] })}
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
            </div>
          )}
          <Drawer
            open={!!draft}
            onOpenChange={(open) => {
              if (!open && !busy) setDraft(null);
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
                    onClick={() => setDraft(null)}
                  />
                </DrawerHeaderActions>
              </DrawerHeader>
              <DrawerBody>
                {draft && (
                  <div className="space-y-5 text-primary">
                    <p className="flex items-center gap-2 text-body-xs-medium">
                      <WorkflowsOutline className="size-4" />
                      {workflow.states.find((state) => state.id === draft.source_id)?.name}
                    </p>
                    <div className="space-y-2">
                      <p className="text-body-xs-medium">{t("web.workflow_ui.flow_type")}</p>
                      <div className="flex h-8 items-center gap-2 rounded-md border border-subtle px-3 text-body-xs-regular">
                        <WorkflowsOutline className="size-4" />
                        {t("web.workflow_ui.transition")}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-body-xs-medium">{t("workflows.workflow_states.state_changes.move_to")}</p>
                      <StateSelect
                        projectId={projectId}
                        value={draft.destination_id}
                        onChange={(destination_id) => setDraft({ ...draft, destination_id })}
                        variant="select-md"
                        bypassWorkflow
                        excludeStateIds={[draft.source_id]}
                        disabled={busy}
                        placeholder={t("web.workflow_ui.select_destination")}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-body-xs-medium">{t("web.workflow_ui.by")}</p>
                      <MemberSelect
                        projectId={projectId}
                        multiple
                        value={draft.member_ids}
                        onChange={(member_ids) => setDraft({ ...draft, member_ids })}
                        variant="select-md"
                        disabled={busy}
                        placeholder={t("web.workflow_ui.all_members")}
                      />
                      <p className="text-caption-md-regular text-tertiary">{t("web.workflow_ui.members_hint")}</p>
                    </div>
                  </div>
                )}
              </DrawerBody>
              <DrawerFooter>
                <Button
                  stretch="auto"
                  variant="ghost"
                  size="md"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                  label={t("discard")}
                />
                <Button
                  stretch="auto"
                  variant="primary"
                  size="md"
                  disabled={busy || !draft?.destination_id}
                  onClick={async () => {
                    if (
                      draft &&
                      (await perform(() =>
                        store.service.saveTransition(
                          workspaceSlug,
                          projectId,
                          {
                            source_id: draft.source_id,
                            destination_id: draft.destination_id,
                            member_ids: draft.member_ids,
                          },
                          draft.id
                        )
                      ))
                    )
                      setDraft(null);
                  }}
                  label={t(busy ? "saving" : "save")}
                />
              </DrawerFooter>
            </DrawerPanel>
          </Drawer>
          <WorkflowHistory
            open={showHistory}
            onClose={() => setShowHistory(false)}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
          />
        </>
      )}
    </SettingsContentWrapper>
  );
});

function RuleCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-caption-md-medium text-secondary">{label}</p>
      <div className="flex min-h-8 items-center gap-2 rounded-md border border-subtle px-3 text-body-xs-regular text-primary">
        {children}
      </div>
    </div>
  );
}

function WorkflowHistory({
  open,
  onClose,
  projectId,
  workspaceSlug,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceSlug: string;
}) {
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const {
    data,
    error: failed,
    isValidating: loading,
    size,
    setSize,
    mutate,
  } = useSWRInfinite<{ results: TWorkflowActivity[]; next_offset: number | null; count: number }>(
    (index, previous) =>
      !open || previous?.next_offset === null
        ? null
        : ["workflow-history", workspaceSlug, projectId, index === 0 ? 0 : previous.next_offset],
    ([, slug, project, offset]: [string, string, string, number]) => store.service.history(slug, project, offset),
    { revalidateFirstPage: false }
  );
  const entries = [...new Map((data ?? []).flatMap((page) => page.results).map((entry) => [entry.id, entry])).values()];
  const next = data?.at(-1)?.next_offset ?? null;
  return (
    <Drawer
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      swipeDirection="right"
    >
      <DrawerPanel side="end" size="sm" variant="overlay">
        <DrawerHeader>
          <DrawerHeaderContent>
            <DrawerTitle>{t("workflows.quick_actions.view_change_history")}</DrawerTitle>
          </DrawerHeaderContent>
          <DrawerHeaderActions side="end">
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={t("close")}
              icon={<X className="size-4" />}
              onClick={onClose}
            />
          </DrawerHeaderActions>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-5">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3">
                <History className="mt-0.5 size-4 shrink-0 text-tertiary" />
                <div className="min-w-0 space-y-1 text-body-xs-regular text-primary">
                  <p>
                    {entry.actor_id ? (
                      <Link
                        className="mr-1 font-medium hover:underline"
                        to={`/${workspaceSlug}/profile/${entry.actor_id}/`}
                      >
                        {entry.actor_name}
                      </Link>
                    ) : (
                      <span className="mr-1 font-medium">{entry.actor_name}</span>
                    )}
                    {t(`web.workflow_ui.history.${entry.action}`, {
                      state: entry.data.state_name || t("web.workflow_ui.project_default"),
                      source: entry.data.source_name ?? "",
                      destination: entry.data.destination_name ?? "",
                      value: t(entry.data.value ? "web.workflow_ui.enabled_value" : "web.workflow_ui.disabled_value"),
                    })}
                  </p>
                  <time className="text-caption-md-regular text-tertiary" dateTime={entry.created_at}>
                    {new Date(entry.created_at).toLocaleString()}
                  </time>
                </div>
              </div>
            ))}
            {!loading && !entries.length && !failed && (
              <p className="text-body-xs-regular text-tertiary">{t("web.workflow_ui.no_history")}</p>
            )}
            {failed && (
              <Button
                stretch="auto"
                size="md"
                variant="ghost"
                onClick={() => void mutate()}
                label={t("common.retry")}
              />
            )}
            {loading ? (
              <output className="text-body-xs-regular text-tertiary">{t("loading")}</output>
            ) : (
              next !== null &&
              !failed && (
                <Button
                  stretch="auto"
                  size="md"
                  variant="ghost"
                  onClick={() => void setSize(size + 1)}
                  label={t("load_more")}
                />
              )
            )}
          </div>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
}
