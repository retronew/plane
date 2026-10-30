import { workflowDisplayName } from "./display-name";
import { useState } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { Link, useParams } from "react-router";
import { ArrowUpRight, History, MoreHorizontal, Pause, Pencil, Play, Plus, Shapes, Trash2 } from "lucide-react";
import { WorkflowsOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Banner } from "@makeplane/propel/components/banner";
import { Badge } from "@makeplane/propel/components/badge";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
import { Switch } from "@makeplane/propel/components/switch";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { ActionMenuContent } from "@plane/blocks/common";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { StateGroupIcon } from "@plane/blocks/icons";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type {
  TLogoProps,
  TProjectIssueType,
  TProjectWorkflow,
  TProjectWorkflowList,
  TWorkflowImpact,
  TWorkflowImpactRequest,
} from "@plane/types";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
import { PageHead } from "@/components/core/page-title";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { getWorkflowErrorCode } from "@/helpers/workflow";
import { WorkflowHistory } from "./history";
import { WorkflowRuleEditor } from "./rule-editor";
import type { DraftRule } from "./rule-editor";
import { WorkflowStateRules } from "./state-rules";
import { WorkflowImpactDialog } from "./impact-dialog";
import { WorkflowMetadata } from "./workflow-metadata";
import { WorkflowSwitcher } from "./workflow-switcher";

type Translate = ReturnType<typeof useTranslation>["t"];

type WorkflowFilterOption = { value: string; label: string; icon: ReactNode };

type WorkflowFilter = {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: WorkflowFilterOption[];
};

type WorkflowUpdatePayload = Partial<
  Pick<TProjectWorkflow, "enabled" | "is_active" | "initial_state_id" | "name" | "description" | "version">
>;

type WorkflowImpactState = { request: TWorkflowImpactRequest; preview: TWorkflowImpact } | null;

const mergeWorkflows = (results: TProjectWorkflow[] | undefined, defaultWorkflow: TProjectWorkflow | undefined) => {
  const workflows = [...(results ?? [])];
  if (defaultWorkflow && !workflows.some((item) => item.is_default || item.id === "default"))
    workflows.unshift(defaultWorkflow);
  return workflows;
};

const resolveWorkflow = (
  workflows: TProjectWorkflow[],
  workflowId: string,
  defaultWorkflow: TProjectWorkflow | undefined
) =>
  workflowId === "default"
    ? (workflows.find((item) => item.is_default || item.id === "default") ?? defaultWorkflow)
    : workflows.find((item) => (item.workflow_id ?? item.id) === workflowId);

const resolveEnabled = (list: TProjectWorkflowList | undefined, workflow: TProjectWorkflow | undefined) =>
  list?.enabled ?? workflow?.enabled ?? false;

const isDefaultWorkflow = (workflow: TProjectWorkflow) => Boolean(workflow.is_default || workflow.id === "default");

const filterAndSortWorkflows = (
  workflows: TProjectWorkflow[],
  filters: { search: string; stateFilter: string; typeFilter: string; sort: string },
  defaultName: string
) => {
  const query = filters.search.trim().toLowerCase();
  return (
    [...workflows]
      .filter(
        (item) =>
          workflowDisplayName(item, defaultName).toLowerCase().includes(query) &&
          (!filters.stateFilter || item.states.some((state) => state.id === filters.stateFilter)) &&
          (!filters.typeFilter || item.issue_type_ids?.includes(filters.typeFilter))
      )
      // Filtering creates a fresh array; keep compatibility with the app's ES target.
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) =>
        filters.sort === "status"
          ? Number(b.is_active) - Number(a.is_active) || a.id.localeCompare(b.id)
          : workflowDisplayName(a, defaultName).localeCompare(workflowDisplayName(b, defaultName)) *
              (filters.sort === "-name" ? -1 : 1) || a.id.localeCompare(b.id)
      )
  );
};

const buildStateFilterOptions = (workflows: TProjectWorkflow[], t: Translate): WorkflowFilterOption[] => [
  {
    value: "",
    label: t("web.workflow_ui.all_states"),
    icon: <FilterFieldIcon field="state" />,
  },
  ...[...new Map(workflows.flatMap((item) => item.states).map((state) => [state.id, state])).values()].map((state) => ({
    value: state.id,
    label: state.name,
    icon: <StateGroupIcon stateGroup={state.group} color={state.color} icon={state.icon} className="size-3.5" />,
  })),
];

function WorkflowTypeOptionIcon({ logoProps }: { logoProps?: Record<string, unknown> }) {
  if (!logoProps?.in_use) {
    return <Shapes className="size-3.5 shrink-0 text-icon-tertiary" aria-hidden="true" />;
  }
  return (
    <span className="shrink-0" aria-hidden="true">
      <Logo logo={logoProps as TLogoProps} size={14} />
    </span>
  );
}

const buildTypeFilterOptions = (issueTypes: TProjectIssueType[] | undefined, t: Translate): WorkflowFilterOption[] => [
  {
    value: "",
    label: t("web.workflow_ui.all_types"),
    icon: <Shapes className="size-3.5 shrink-0 text-icon-tertiary" aria-hidden="true" />,
  },
  ...(issueTypes ?? []).map((type) => ({
    value: type.id,
    label: type.name,
    icon: <WorkflowTypeOptionIcon logoProps={type.logo_props} />,
  })),
];

const buildSortOptions = (t: Translate): WorkflowFilterOption[] => [
  {
    value: "name",
    label: t("web.workflow_ui.sort_name"),
    icon: <FilterFieldIcon field="asc" />,
  },
  {
    value: "-name",
    label: t("web.workflow_ui.sort_name_desc"),
    icon: <FilterFieldIcon field="desc" />,
  },
  {
    value: "status",
    label: t("web.workflow_ui.columns.status"),
    icon: <FilterFieldIcon field="status" />,
  },
];

const getWorkflowStatesLabel = (workflow: TProjectWorkflow, t: Translate) =>
  isDefaultWorkflow(workflow) ? t("web.workflow_ui.all_states") : workflow.states.map((state) => state.name).join(", ");

const getWorkflowTypeNames = (workflow: TProjectWorkflow, issueTypes: TProjectIssueType[] | undefined, t: Translate) =>
  (issueTypes ?? [])
    .filter((type) => type.workflow_id === (workflow.workflow_id ?? workflow.id))
    .map((type) => type.name)
    .join(", ") || t("common.none");

const getWorkflowAppliesTo = (workflow: TProjectWorkflow, issueTypes: TProjectIssueType[] | undefined, t: Translate) =>
  isDefaultWorkflow(workflow) ? t("web.workflow_ui.unbound_types") : getWorkflowTypeNames(workflow, issueTypes, t);

const createNextRuleDraft = (draft: DraftRule): DraftRule => ({
  source_id: draft.source_id,
  destination_id: "",
  member_ids: [],
  kind: draft.kind,
  approver_mode: "all",
  approver_ids: [],
  reject_state_id: null,
  steps: [],
});

const reportWorkflowError = (error: unknown, t: Translate) => {
  const code = getWorkflowErrorCode(error);
  setToast({
    type: "error",
    title: t("error"),
    message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed"),
  });
};

function WorkflowSettingsBreadcrumbs(props: {
  detail: boolean;
  base: string;
  label: string;
  workflows: TProjectWorkflow[];
  workflowId: string;
}) {
  return (
    <Breadcrumbs>
      <Breadcrumbs.Item
        component={
          <BreadcrumbLink
            href={props.detail ? props.base : undefined}
            label={props.label}
            icon={<WorkflowsOutline className="size-4 text-tertiary" />}
          />
        }
      />
      {props.detail && (
        <Breadcrumbs.Item
          component={<WorkflowSwitcher workflows={props.workflows} currentId={props.workflowId} base={props.base} />}
        />
      )}
    </Breadcrumbs>
  );
}

function WorkflowSettingsTitles(props: {
  detail: boolean;
  workflow: TProjectWorkflow | undefined;
  label: string;
  defaultName: string;
  t: Translate;
}) {
  const { detail, workflow, label, defaultName, t } = props;
  const name = workflowDisplayName(workflow, defaultName);
  return (
    <>
      <PageHead title={`${detail ? name : label} - ${t("settings")}`} />
      <SettingsHeading
        title={detail ? name : label}
        description={
          detail ? workflow?.description || t("web.workflow_ui.default_description") : t("web.workflow_ui.description")
        }
      />
    </>
  );
}

function WorkflowSettingsAside(props: {
  open: boolean;
  historyId: string | null;
  onClose: () => void;
  projectId: string;
  workspaceSlug: string;
}) {
  return (
    <WorkflowHistory
      open={props.open}
      onClose={props.onClose}
      projectId={props.projectId}
      workspaceSlug={props.workspaceSlug}
      workflowId={props.historyId ?? "default"}
    />
  );
}

function WorkflowLoadState({ failed, onRetry, t }: { failed: boolean; onRetry: () => void; t: Translate }) {
  return (
    <output className="mt-8 block rounded-lg border border-subtle p-6 text-body-xs-regular text-secondary">
      {failed ? (
        <>
          <p>{t("web.workflow_ui.load_failed")}</p>
          <Button stretch="auto" variant="ghost" size="md" onClick={onRetry} label={t("common.retry")} />
        </>
      ) : (
        t("loading")
      )}
    </output>
  );
}

function WorkflowExecutionsLink(props: {
  detail: boolean;
  canManage: boolean;
  workflow: TProjectWorkflow | undefined;
  workspaceSlug: string;
  projectId: string;
  t: Translate;
}) {
  const { detail, canManage, workflow, workspaceSlug, projectId, t } = props;
  if (!detail || !canManage || !workflow?.workflow_id) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <Link
        className="inline-flex items-center gap-2 rounded px-2 py-1 text-body-xs-medium text-accent-primary hover:underline"
        to={`/${workspaceSlug}/settings/projects/${projectId}/runner/?tab=executions&workflow_id=${workflow.workflow_id}`}
      >
        <History className="size-3.5" />
        {t("web.workflow_runner.view_executions")}
      </Link>
    </div>
  );
}

function WorkflowFilterSelects({ filters }: { filters: WorkflowFilter[] }) {
  return (
    <>
      {filters.map((filter) => (
        <Select<string>
          key={filter.label}
          items={filter.options}
          value={filter.value}
          onValueChange={(value) => {
            if (value !== null) filter.onChange(value);
          }}
        >
          <SelectTrigger size="md" variant="secondary" width="fit" icon={filter.icon} aria-label={filter.label} />
          <SelectContent sizing="auto">
            <SelectList>
              {filter.options.map((option) => (
                <SelectItem key={option.value} {...option} />
              ))}
            </SelectList>
          </SelectContent>
        </Select>
      ))}
    </>
  );
}

function WorkflowRowActions(props: {
  item: TProjectWorkflow;
  canManage: boolean;
  busy: boolean;
  onOpenHistory: (id: string) => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  t: Translate;
}) {
  const { item, canManage, busy, onOpenHistory, onEdit, onToggle, onDelete, t } = props;
  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            variant="ghost"
            size="sm"
            icon={<MoreHorizontal className="size-4" />}
            aria-label={`${t("aria_labels.common.more_actions")} ${workflowDisplayName(item, t("web.workflow_ui.default_name"))}`}
          />
        }
      />
      <ActionMenuContent
        side="bottom"
        align="end"
        heightBehavior="flip"
        collisionAvoidance={{ side: "none", align: "shift" }}
      >
        <MenuItem
          icon={<History className="size-3.5" />}
          label={t("workflows.quick_actions.view_change_history")}
          onClick={() => onOpenHistory(item.workflow_id ?? item.id)}
        />
        {canManage && (
          <>
            <MenuItem
              disabled={busy}
              icon={item.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              label={t(item.is_active ? "web.workflow_ui.disable" : "web.workflow_ui.enable_one")}
              onClick={onToggle}
            />
            <MenuItem icon={<Pencil className="size-3.5" />} label={t("edit")} onClick={onEdit} />
            {!isDefaultWorkflow(item) && (
              <MenuItem
                disabled={busy}
                variant="danger"
                icon={<Trash2 className="size-3.5" />}
                label={t("delete")}
                onClick={onDelete}
              />
            )}
          </>
        )}
      </ActionMenuContent>
    </Menu>
  );
}

function WorkflowRow(props: {
  item: TProjectWorkflow;
  base: string;
  issueTypes: TProjectIssueType[] | undefined;
  canManage: boolean;
  busy: boolean;
  onOpenHistory: (id: string) => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  t: Translate;
}) {
  const { item, base, issueTypes, canManage, busy, onOpenHistory, onEdit, onToggle, onDelete, t } = props;
  return (
    <tr className="border-t border-subtle hover:bg-layer-1">
      <td className="px-4 py-3">
        <Link to={`${base}${item.workflow_id ?? item.id}/`} className="font-medium hover:underline">
          {workflowDisplayName(item, t("web.workflow_ui.default_name"))}
        </Link>
      </td>
      <td className="px-4 py-3">
        <Badge
          size="xs"
          variant={item.is_active ? "success" : "neutral"}
          label={t(item.is_active ? "web.workflow_ui.active" : "web.workflow_ui.inactive")}
        />
      </td>
      <td className="px-4 py-3 text-secondary">{getWorkflowStatesLabel(item, t)}</td>
      <td className="px-4 py-3 text-secondary">{getWorkflowAppliesTo(item, issueTypes, t)}</td>
      <td className="w-12 px-3 py-2 text-right">
        <WorkflowRowActions
          item={item}
          canManage={canManage}
          busy={busy}
          onOpenHistory={onOpenHistory}
          onEdit={onEdit}
          onToggle={onToggle}
          onDelete={onDelete}
          t={t}
        />
      </td>
    </tr>
  );
}

function WorkflowListSection(props: {
  list: TProjectWorkflowList | undefined;
  workflow: TProjectWorkflow | undefined;
  filtered: TProjectWorkflow[];
  filters: WorkflowFilter[];
  issueTypes: TProjectIssueType[] | undefined;
  canManage: boolean;
  busy: boolean;
  label: string;
  base: string;
  projectId: string;
  workspaceSlug: string;
  search: string;
  onSearchChange: (value: string) => void;
  showTypeHint: boolean;
  onDismissTypeHint: () => void;
  onEnableChange: (enabled: boolean) => void;
  onEditMetadata: (value: TProjectWorkflow | "new") => void;
  onOpenHistory: (id: string) => void;
  onToggleWorkflow: (item: TProjectWorkflow) => void;
  onDeleteWorkflow: (item: TProjectWorkflow) => void;
  t: Translate;
}) {
  const {
    list,
    workflow,
    filtered,
    filters,
    issueTypes,
    canManage,
    busy,
    label,
    base,
    projectId,
    workspaceSlug,
    search,
    onSearchChange,
    showTypeHint,
    onDismissTypeHint,
    onEnableChange,
    onEditMetadata,
    onOpenHistory,
    onToggleWorkflow,
    onDeleteWorkflow,
    t,
  } = props;
  return (
    <div className="mt-6 flex flex-col gap-12">
      <SettingsBoxedControlItem
        title={t("web.workflow_ui.enable")}
        description={t("web.workflow_ui.enable_description")}
        control={
          <Switch
            size="md"
            checked={resolveEnabled(list, workflow)}
            disabled={busy || !canManage}
            aria-label={t("web.workflow_ui.enable")}
            onCheckedChange={onEnableChange}
          />
        }
      />
      <section className="flex flex-col gap-4">
        <h4 className="text-body-md-medium text-primary">{label}</h4>
        <div className="flex flex-wrap items-center gap-2">
          <ExpandableSearch
            size="md"
            aria-label={t("web.workflow_ui.search")}
            placeholder={t("web.workflow_ui.search")}
            clearLabel={t("common.clear")}
            value={search}
            onValueChange={(value) => onSearchChange(value ?? "")}
          />
          <WorkflowFilterSelects filters={filters} />
          {canManage && (
            <div className="ml-auto flex shrink-0 items-center">
              <Button
                stretch="auto"
                variant="primary"
                size="sm"
                icon={<Plus className="size-3.5" />}
                label={t("web.workflow_ui.new_workflow")}
                onClick={() => onEditMetadata("new")}
              />
            </div>
          )}
        </div>
        {showTypeHint && (
          <Banner
            placement="inline"
            variant="warning"
            role="alert"
            description={t("web.workflow_ui.types_workflow_hint")}
            onDismiss={onDismissTypeHint}
            dismissLabel={t("close")}
            render={<div className="[&_[data-slot=banner-icon]]:self-center" />}
            actions={
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("web.workflow_ui.type_settings")}
                icon={<ArrowUpRight className="size-3.5" />}
                iconPosition="end"
                nativeButton={false}
                render={<Link to={`/${workspaceSlug}/settings/projects/${projectId}/issue-types/`} />}
              />
            }
          />
        )}
        <div className="overflow-x-auto rounded-lg border border-subtle">
          <table className="w-full text-left text-body-xs-regular">
            <thead className="bg-layer-1 text-tertiary">
              <tr>
                {["name", "status", "states", "applies_to"].map((key) => (
                  <th key={key} className="h-9 px-4 py-1 font-medium">
                    {t(`web.workflow_ui.columns.${key}`)}
                  </th>
                ))}
                <th className="h-9 py-1">
                  <span className="sr-only">{t("web.workflow_ui.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <WorkflowRow
                  key={item.id}
                  item={item}
                  base={base}
                  issueTypes={issueTypes}
                  canManage={canManage}
                  busy={busy}
                  onOpenHistory={onOpenHistory}
                  onEdit={() => onEditMetadata(item)}
                  onToggle={() => onToggleWorkflow(item)}
                  onDelete={() => onDeleteWorkflow(item)}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function WorkflowDetailSection(props: {
  workflow: TProjectWorkflow;
  draft: DraftRule | null;
  onDraftChange: (draft: DraftRule | null) => void;
  busy: boolean;
  canManage: boolean;
  workflowId: string;
  projectId: string;
  workspaceSlug: string;
  saveRule: (keepOpen: boolean) => Promise<void>;
  onEditMetadata: (value: TProjectWorkflow | "new") => void;
  onOpenHistory: (id: string) => void;
  onInitial: (id: string) => void;
  onCreation: (id: string, allow: boolean) => void;
  onDeleteTransition: (id: string) => void;
  t: Translate;
}) {
  const {
    workflow,
    draft,
    onDraftChange,
    busy,
    canManage,
    workflowId,
    projectId,
    workspaceSlug,
    saveRule,
    onEditMetadata,
    onOpenHistory,
    onInitial,
    onCreation,
    onDeleteTransition,
    t,
  } = props;
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-body-sm-medium">{t("project_settings.workflows.detail.define")}</h4>
        <div className="flex gap-2">
          {canManage && (
            <Button
              stretch="auto"
              size="sm"
              variant="ghost"
              label={t("edit")}
              onClick={() => onEditMetadata(workflow)}
            />
          )}
          <IconButton
            size="sm"
            variant="ghost"
            icon={<History className="size-3.5" />}
            aria-label={t("workflows.quick_actions.view_change_history")}
            onClick={() => onOpenHistory(workflowId)}
          />
        </div>
      </div>
      {(!workflow.enabled || !workflow.is_active) && (
        <output className="block rounded-lg bg-layer-1 px-3 py-2 text-body-xs-regular text-secondary">
          {t("web.workflow_ui.paused_hint")}
        </output>
      )}
      <WorkflowStateRules
        workflow={workflow}
        draft={draft}
        busy={busy}
        onEdit={onDraftChange}
        onInitial={onInitial}
        onCreation={onCreation}
        onDelete={onDeleteTransition}
      />
      <WorkflowRuleEditor
        draft={draft}
        onChange={onDraftChange}
        onSave={saveRule}
        workflow={workflow}
        projectId={projectId}
        workspaceSlug={workspaceSlug}
        busy={busy}
      />
    </div>
  );
}

function WorkflowDialogs(props: {
  metadata: TProjectWorkflow | "new" | null;
  metadataOpen: boolean;
  setMetadata: (value: TProjectWorkflow | "new" | null) => void;
  setMetadataOpen: (open: boolean) => void;
  preview: (request: TWorkflowImpactRequest) => void;
  impact: WorkflowImpactState;
  impactOpen: boolean;
  setImpact: (value: WorkflowImpactState) => void;
  setImpactOpen: (open: boolean) => void;
  projectId: string;
  workspaceSlug: string;
}) {
  const {
    metadata,
    metadataOpen,
    setMetadata,
    setMetadataOpen,
    preview,
    impact,
    impactOpen,
    setImpact,
    setImpactOpen,
    projectId,
    workspaceSlug,
  } = props;
  return (
    <>
      {metadata && (
        <WorkflowMetadata
          workflow={metadata === "new" ? undefined : metadata}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          open={metadataOpen}
          onClose={() => setMetadataOpen(false)}
          onOpenChangeComplete={(open) => {
            if (!open) setMetadata(null);
          }}
          onPreview={(request) => {
            setMetadataOpen(false);
            void preview(request);
          }}
        />
      )}
      {impact && (
        <WorkflowImpactDialog
          key={impact.preview.token}
          request={impact.request}
          impact={impact.preview}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          open={impactOpen}
          onClose={() => setImpactOpen(false)}
          onApplied={() => setImpactOpen(false)}
          onOpenChangeComplete={(open) => {
            if (!open) setImpact(null);
          }}
        />
      )}
    </>
  );
}

function WorkflowSettingsContent(props: {
  detail: boolean;
  workflowId: string;
  workspaceSlug: string;
  projectId: string;
  base: string;
  label: string;
  list: TProjectWorkflowList | undefined;
  workflows: TProjectWorkflow[];
  workflow: TProjectWorkflow | undefined;
  filtered: TProjectWorkflow[];
  filters: WorkflowFilter[];
  issueTypes: TProjectIssueType[] | undefined;
  canManage: boolean;
  busy: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  showTypeHint: boolean;
  onDismissTypeHint: () => void;
  onEnableChange: (enabled: boolean) => void;
  onEditMetadata: (value: TProjectWorkflow | "new") => void;
  onOpenHistory: (id: string) => void;
  onToggleWorkflow: (item: TProjectWorkflow) => void;
  onDeleteWorkflow: (item: TProjectWorkflow) => void;
  draft: DraftRule | null;
  onDraftChange: (draft: DraftRule | null) => void;
  onInitial: (id: string) => void;
  onCreation: (id: string, allow: boolean) => void;
  onDeleteTransition: (id: string) => void;
  saveRule: (keepOpen: boolean) => Promise<void>;
  metadata: TProjectWorkflow | "new" | null;
  metadataOpen: boolean;
  setMetadata: (value: TProjectWorkflow | "new" | null) => void;
  setMetadataOpen: (open: boolean) => void;
  preview: (request: TWorkflowImpactRequest) => void;
  impact: WorkflowImpactState;
  impactOpen: boolean;
  setImpact: (value: WorkflowImpactState) => void;
  setImpactOpen: (open: boolean) => void;
  failed: boolean;
  onRetry: () => void;
  t: Translate;
}) {
  const {
    detail,
    workflowId,
    workspaceSlug,
    projectId,
    base,
    label,
    list,
    workflows,
    workflow,
    filtered,
    filters,
    issueTypes,
    canManage,
    busy,
    search,
    onSearchChange,
    showTypeHint,
    onDismissTypeHint,
    onEnableChange,
    onEditMetadata,
    onOpenHistory,
    onToggleWorkflow,
    onDeleteWorkflow,
    draft,
    onDraftChange,
    onInitial,
    onCreation,
    onDeleteTransition,
    saveRule,
    metadata,
    metadataOpen,
    setMetadata,
    setMetadataOpen,
    preview,
    impact,
    impactOpen,
    setImpact,
    setImpactOpen,
    failed,
    onRetry,
    t,
  } = props;
  if (!list && !workflows.length) return <WorkflowLoadState failed={failed} onRetry={onRetry} t={t} />;
  return (
    <>
      <WorkflowExecutionsLink
        detail={detail}
        canManage={canManage}
        workflow={workflow}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        t={t}
      />
      {detail ? (
        workflow ? (
          <WorkflowDetailSection
            workflow={workflow}
            draft={draft}
            onDraftChange={onDraftChange}
            busy={busy}
            canManage={canManage}
            workflowId={workflowId}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
            saveRule={saveRule}
            onEditMetadata={onEditMetadata}
            onOpenHistory={onOpenHistory}
            onInitial={onInitial}
            onCreation={onCreation}
            onDeleteTransition={onDeleteTransition}
            t={t}
          />
        ) : (
          <p className="mt-6 text-body-xs-regular text-secondary">{t("web.workflow_ui.load_failed")}</p>
        )
      ) : (
        <WorkflowListSection
          list={list}
          workflow={workflow}
          filtered={filtered}
          filters={filters}
          issueTypes={issueTypes}
          canManage={canManage}
          busy={busy}
          label={label}
          base={base}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          search={search}
          onSearchChange={onSearchChange}
          showTypeHint={showTypeHint}
          onDismissTypeHint={onDismissTypeHint}
          onEnableChange={onEnableChange}
          onEditMetadata={onEditMetadata}
          onOpenHistory={onOpenHistory}
          onToggleWorkflow={onToggleWorkflow}
          onDeleteWorkflow={onDeleteWorkflow}
          t={t}
        />
      )}
      <WorkflowDialogs
        metadata={metadata}
        metadataOpen={metadataOpen}
        setMetadata={setMetadata}
        setMetadataOpen={setMetadataOpen}
        preview={preview}
        impact={impact}
        impactOpen={impactOpen}
        setImpact={setImpact}
        setImpactOpen={setImpactOpen}
        projectId={projectId}
        workspaceSlug={workspaceSlug}
      />
    </>
  );
}

export const WorkflowSettings = observer(function WorkflowSettings({ detail = false }: { detail?: boolean }) {
  const { workspaceSlug = "", projectId = "", workflowId = "default" } = useParams();
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const list = store.lists[projectId];
  const defaultWorkflow = store.workflows[projectId];
  const workflows = mergeWorkflows(list?.results, defaultWorkflow);
  const workflow = resolveWorkflow(workflows, workflowId, defaultWorkflow);
  const issueTypes = store.issueTypes[projectId]?.results;
  const [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<DraftRule | null>(null),
    [historyId, setHistoryId] = useState<string | null>(null),
    [metadata, setMetadata] = useState<TProjectWorkflow | "new" | null>(null),
    [impact, setImpact] = useState<WorkflowImpactState>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const editMetadata = (value: TProjectWorkflow | "new") => {
    setMetadata(value);
    setMetadataOpen(true);
  };
  const [showTypeHint, setShowTypeHint] = useState(true);
  const [search, setSearch] = useState(""),
    [stateFilter, setStateFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState(""),
    [sort, setSort] = useState("name");
  const base = `/${workspaceSlug}/settings/projects/${projectId}/workflows/`,
    canManage = list?.can_manage ?? workflow?.can_manage ?? false;
  const label = t("common.workflows"),
    defaultName = t("web.workflow_ui.default_name");
  const perform = async (operation: () => Promise<TProjectWorkflow>) => {
    if (busy || !canManage) return false;
    setBusy(true);
    try {
      store.set(projectId, await operation());
      return true;
    } catch (error) {
      reportWorkflowError(error, t);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const preview = async (request: TWorkflowImpactRequest) => {
    if (busy || !canManage) return;
    setBusy(true);
    try {
      setImpact({ request, preview: await store.service.preview(workspaceSlug, projectId, request) });
      setImpactOpen(true);
    } catch (error) {
      reportWorkflowError(error, t);
    } finally {
      setBusy(false);
    }
  };
  const update = (data: WorkflowUpdatePayload) =>
    workflow &&
    perform(() => store.service.update(workspaceSlug, projectId, { ...data, version: workflow.version }, workflowId));
  const saveRule = async (keepOpen: boolean) => {
    if (!draft || !workflow) return;
    const { id, ...payload } = draft;
    const saved = await perform(() =>
      store.service.saveTransition(workspaceSlug, projectId, payload, id, workflowId, workflow.version)
    );
    if (!saved) return;
    setDraft(keepOpen ? createNextRuleDraft(draft) : null);
  };
  const openHistory = (id: string) => {
    setHistoryId(id);
    setHistoryOpen(true);
  };
  const handleEnableChange = (enabled: boolean) =>
    enabled
      ? void preview({ operation: "enable", enabled })
      : void perform(() => store.service.update(workspaceSlug, projectId, { enabled }));
  const handleToggleWorkflow = (item: TProjectWorkflow) =>
    item.is_active
      ? void perform(() =>
          store.service.update(
            workspaceSlug,
            projectId,
            { is_active: false, version: item.version },
            item.workflow_id ?? item.id
          )
        )
      : void preview({ operation: "enable", workflow_id: item.workflow_id ?? item.id, is_active: true });
  const handleDeleteWorkflow = (item: TProjectWorkflow) =>
    void preview({ operation: "delete", workflow_id: item.workflow_id ?? item.id });
  const filtered = filterAndSortWorkflows(workflows, { search, stateFilter, typeFilter, sort }, defaultName);
  const filters: WorkflowFilter[] = [
    {
      label: t("web.workflow_ui.filter_state"),
      icon: <FilterFieldIcon field="state" />,
      value: stateFilter,
      onChange: setStateFilter,
      options: buildStateFilterOptions(workflows, t),
    },
    {
      label: t("web.workflow_ui.filter_type"),
      icon: <Shapes className="size-3.5 shrink-0 text-icon-tertiary" aria-hidden="true" />,
      value: typeFilter,
      onChange: setTypeFilter,
      options: buildTypeFilterOptions(issueTypes, t),
    },
    {
      label: t("common.sort.label"),
      icon: <FilterFieldIcon field="order_by" />,
      value: sort,
      onChange: setSort,
      options: buildSortOptions(t),
    },
  ];
  return (
    <SettingsContentWrapper
      aside={
        <WorkflowSettingsAside
          open={historyOpen}
          historyId={historyId}
          onClose={() => setHistoryOpen(false)}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
        />
      }
      header={
        <SettingsPageHeader
          leftItem={
            <WorkflowSettingsBreadcrumbs
              detail={detail}
              base={base}
              label={label}
              workflows={workflows}
              workflowId={workflowId}
            />
          }
        />
      }
    >
      <WorkflowSettingsTitles detail={detail} workflow={workflow} label={label} defaultName={defaultName} t={t} />
      <WorkflowSettingsContent
        detail={detail}
        workflowId={workflowId}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        base={base}
        label={label}
        list={list}
        workflows={workflows}
        workflow={workflow}
        filtered={filtered}
        filters={filters}
        issueTypes={issueTypes}
        canManage={canManage}
        busy={busy}
        search={search}
        onSearchChange={setSearch}
        showTypeHint={showTypeHint}
        onDismissTypeHint={() => setShowTypeHint(false)}
        onEnableChange={handleEnableChange}
        onEditMetadata={editMetadata}
        onOpenHistory={openHistory}
        onToggleWorkflow={handleToggleWorkflow}
        onDeleteWorkflow={handleDeleteWorkflow}
        draft={draft}
        onDraftChange={setDraft}
        onInitial={(id) => void update({ initial_state_id: id })}
        onCreation={(id, allow) =>
          void perform(() =>
            store.service.setCreation(workspaceSlug, projectId, id, allow, workflowId, workflow?.version)
          )
        }
        onDeleteTransition={(id) =>
          void perform(() =>
            store.service.deleteTransition(workspaceSlug, projectId, id, workflowId, workflow?.version)
          )
        }
        saveRule={saveRule}
        metadata={metadata}
        metadataOpen={metadataOpen}
        setMetadata={setMetadata}
        setMetadataOpen={setMetadataOpen}
        preview={preview}
        impact={impact}
        impactOpen={impactOpen}
        setImpact={setImpact}
        setImpactOpen={setImpactOpen}
        failed={Boolean(store.errors[projectId])}
        onRetry={() => void store.fetch(workspaceSlug, projectId, true).catch(() => undefined)}
        t={t}
      />
    </SettingsContentWrapper>
  );
});
