import { useState } from "react";
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
import type { TLogoProps, TProjectWorkflow, TWorkflowImpact, TWorkflowImpactRequest } from "@plane/types";
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

export const WorkflowSettings = observer(function WorkflowSettings({ detail = false }: { detail?: boolean }) {
  const { workspaceSlug = "", projectId = "", workflowId = "default" } = useParams();
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const list = store.lists[projectId];
  const defaultWorkflow = store.workflows[projectId];
  const workflows = [...(list?.results ?? [])];
  if (defaultWorkflow && !workflows.some((item) => item.is_default || item.id === "default"))
    workflows.unshift(defaultWorkflow);
  const workflow =
    workflowId === "default"
      ? (workflows.find((item) => item.is_default || item.id === "default") ?? store.workflows[projectId])
      : workflows.find((item) => (item.workflow_id ?? item.id) === workflowId);
  const [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<DraftRule | null>(null),
    [historyId, setHistoryId] = useState<string | null>(null),
    [metadata, setMetadata] = useState<TProjectWorkflow | "new" | null>(null),
    [impact, setImpact] = useState<{ request: TWorkflowImpactRequest; preview: TWorkflowImpact } | null>(null);
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
    name = workflow?.name || t("web.workflow_ui.default_name");
  const reportError = (error: unknown) => {
    const code = getWorkflowErrorCode(error);
    setToast({
      type: "error",
      title: t("error"),
      message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed"),
    });
  };
  const perform = async (operation: () => Promise<TProjectWorkflow>) => {
    if (busy || !canManage) return false;
    setBusy(true);
    try {
      store.set(projectId, await operation());
      return true;
    } catch (error) {
      reportError(error);
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
      reportError(error);
    } finally {
      setBusy(false);
    }
  };
  const update = (data: Parameters<typeof store.service.update>[2]) =>
    workflow &&
    perform(() => store.service.update(workspaceSlug, projectId, { ...data, version: workflow.version }, workflowId));
  const saveRule = async (keepOpen: boolean) => {
    if (!draft || !workflow) return;
    const { id, ...payload } = draft;
    const saved = await perform(() =>
      store.service.saveTransition(workspaceSlug, projectId, payload, id, workflowId, workflow.version)
    );
    if (saved)
      setDraft(
        keepOpen
          ? {
              source_id: draft.source_id,
              destination_id: "",
              member_ids: [],
              kind: draft.kind,
              approver_mode: "all",
              approver_ids: [],
              reject_state_id: null,
              steps: [],
            }
          : null
      );
  };
  const filtered = [...workflows]
    .filter(
      (item) =>
        (item.name || t("web.workflow_ui.default_name")).toLowerCase().includes(search.trim().toLowerCase()) &&
        (!stateFilter || item.states.some((state) => state.id === stateFilter)) &&
        (!typeFilter || item.issue_type_ids?.includes(typeFilter))
    )
    // Filtering creates a fresh array; keep compatibility with the app's ES target.
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((a, b) =>
      sort === "status"
        ? Number(b.is_active) - Number(a.is_active) || a.id.localeCompare(b.id)
        : (a.name ?? "").localeCompare(b.name ?? "") * (sort === "-name" ? -1 : 1) || a.id.localeCompare(b.id)
    );
  return (
    <SettingsContentWrapper
      aside={
        <WorkflowHistory
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          workflowId={historyId ?? "default"}
        />
      }
      header={
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
                  component={<WorkflowSwitcher workflows={workflows} currentId={workflowId} base={base} />}
                />
              )}
            </Breadcrumbs>
          }
        />
      }
    >
      <PageHead title={`${detail ? name : label} - ${t("settings")}`} />
      <SettingsHeading
        title={detail ? name : label}
        description={
          detail ? workflow?.description || t("web.workflow_ui.default_description") : t("web.workflow_ui.description")
        }
      />
      {!list && !workflows.length ? (
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
          {detail && canManage && workflow?.workflow_id && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link
                className="inline-flex items-center gap-2 rounded px-2 py-1 text-body-xs-medium text-accent-primary hover:underline"
                to={`/${workspaceSlug}/settings/projects/${projectId}/runner/?tab=executions&workflow_id=${workflow.workflow_id}`}
              >
                <History className="size-3.5" />
                {t("web.workflow_runner.view_executions")}
              </Link>
            </div>
          )}
          {!detail ? (
            <div className="mt-6 flex flex-col gap-12">
              <SettingsBoxedControlItem
                title={t("web.workflow_ui.enable")}
                description={t("web.workflow_ui.enable_description")}
                control={
                  <Switch
                    size="md"
                    checked={list?.enabled ?? workflow?.enabled ?? false}
                    disabled={busy || !canManage}
                    aria-label={t("web.workflow_ui.enable")}
                    onCheckedChange={(enabled) =>
                      enabled
                        ? void preview({ operation: "enable", enabled })
                        : void perform(() => store.service.update(workspaceSlug, projectId, { enabled }))
                    }
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
                    onValueChange={(value) => setSearch(value ?? "")}
                  />
                  {[
                    {
                      label: t("web.workflow_ui.filter_state"),
                      icon: <FilterFieldIcon field="state" />,
                      value: stateFilter,
                      onChange: setStateFilter,
                      options: [
                        {
                          value: "",
                          label: t("web.workflow_ui.all_states"),
                          icon: <FilterFieldIcon field="state" />,
                        },
                        ...[
                          ...new Map(
                            workflows.flatMap((item) => item.states).map((state) => [state.id, state])
                          ).values(),
                        ].map((state) => ({
                          value: state.id,
                          label: state.name,
                          icon: <StateGroupIcon stateGroup={state.group} color={state.color} className="size-3.5" />,
                        })),
                      ],
                    },
                    {
                      label: t("web.workflow_ui.filter_type"),
                      icon: <Shapes className="size-3.5 shrink-0 text-icon-tertiary" aria-hidden="true" />,
                      value: typeFilter,
                      onChange: setTypeFilter,
                      options: [
                        {
                          value: "",
                          label: t("web.workflow_ui.all_types"),
                          icon: <Shapes className="size-3.5 shrink-0 text-icon-tertiary" aria-hidden="true" />,
                        },
                        ...(store.issueTypes[projectId]?.results ?? []).map((type) => ({
                          value: type.id,
                          label: type.name,
                          icon: type.logo_props?.in_use ? (
                            <span className="shrink-0" aria-hidden="true">
                              <Logo logo={type.logo_props as TLogoProps} size={14} />
                            </span>
                          ) : (
                            <Shapes className="size-3.5 shrink-0 text-icon-tertiary" aria-hidden="true" />
                          ),
                        })),
                      ],
                    },
                    {
                      label: t("common.sort.label"),
                      icon: <FilterFieldIcon field="order_by" />,
                      value: sort,
                      onChange: setSort,
                      options: [
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
                      ],
                    },
                  ].map((filter) => (
                    <Select<string>
                      key={filter.label}
                      items={filter.options}
                      value={filter.value}
                      onValueChange={(value) => {
                        if (value !== null) filter.onChange(value);
                      }}
                    >
                      <SelectTrigger
                        size="md"
                        variant="secondary"
                        width="fit"
                        icon={filter.icon}
                        aria-label={filter.label}
                      />
                      <SelectContent sizing="auto">
                        <SelectList>
                          {filter.options.map((option) => (
                            <SelectItem key={option.value} {...option} />
                          ))}
                        </SelectList>
                      </SelectContent>
                    </Select>
                  ))}
                  {canManage && (
                    <div className="ml-auto flex shrink-0 items-center">
                      <Button
                        stretch="auto"
                        variant="primary"
                        size="sm"
                        icon={<Plus className="size-3.5" />}
                        label={t("web.workflow_ui.new_workflow")}
                        onClick={() => editMetadata("new")}
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
                    onDismiss={() => setShowTypeHint(false)}
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
                        <tr key={item.id} className="border-t border-subtle hover:bg-layer-1">
                          <td className="px-4 py-3">
                            <Link to={`${base}${item.workflow_id ?? item.id}/`} className="font-medium hover:underline">
                              {item.name || t("web.workflow_ui.default_name")}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              size="xs"
                              variant={item.is_active ? "success" : "neutral"}
                              label={t(item.is_active ? "web.workflow_ui.active" : "web.workflow_ui.inactive")}
                            />
                          </td>
                          <td className="px-4 py-3 text-secondary">
                            {item.is_default || item.id === "default"
                              ? t("web.workflow_ui.all_states")
                              : item.states.map((state) => state.name).join(", ")}
                          </td>
                          <td className="px-4 py-3 text-secondary">
                            {item.is_default || item.id === "default"
                              ? t("web.workflow_ui.unbound_types")
                              : store.issueTypes[projectId]?.results
                                  .filter((type) => type.workflow_id === (item.workflow_id ?? item.id))
                                  .map((type) => type.name)
                                  .join(", ") || t("common.none")}
                          </td>
                          <td className="w-12 px-3 py-2 text-right">
                            <Menu>
                              <MenuTrigger
                                render={
                                  <IconButton
                                    variant="ghost"
                                    size="sm"
                                    icon={<MoreHorizontal className="size-4" />}
                                    aria-label={`${t("aria_labels.common.more_actions")} ${item.name || t("web.workflow_ui.default_name")}`}
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
                                  onClick={() => {
                                    setHistoryId(item.workflow_id ?? item.id);
                                    setHistoryOpen(true);
                                  }}
                                />
                                {canManage && (
                                  <>
                                    <MenuItem
                                      disabled={busy}
                                      icon={
                                        item.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />
                                      }
                                      label={t(
                                        item.is_active ? "web.workflow_ui.disable" : "web.workflow_ui.enable_one"
                                      )}
                                      onClick={() =>
                                        item.is_active
                                          ? void perform(() =>
                                              store.service.update(
                                                workspaceSlug,
                                                projectId,
                                                { is_active: false, version: item.version },
                                                item.workflow_id ?? item.id
                                              )
                                            )
                                          : void preview({
                                              operation: "enable",
                                              workflow_id: item.workflow_id ?? item.id,
                                              is_active: true,
                                            })
                                      }
                                    />
                                    <MenuItem
                                      icon={<Pencil className="size-3.5" />}
                                      label={t("edit")}
                                      onClick={() => editMetadata(item)}
                                    />
                                    {!item.is_default && item.id !== "default" && (
                                      <MenuItem
                                        disabled={busy}
                                        variant="danger"
                                        icon={<Trash2 className="size-3.5" />}
                                        label={t("delete")}
                                        onClick={() =>
                                          void preview({
                                            operation: "delete",
                                            workflow_id: item.workflow_id ?? item.id,
                                          })
                                        }
                                      />
                                    )}
                                  </>
                                )}
                              </ActionMenuContent>
                            </Menu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : workflow ? (
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
                      onClick={() => editMetadata(workflow)}
                    />
                  )}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={<History className="size-3.5" />}
                    aria-label={t("workflows.quick_actions.view_change_history")}
                    onClick={() => {
                      setHistoryId(workflowId);
                      setHistoryOpen(true);
                    }}
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
                onEdit={setDraft}
                onInitial={(id) => void update({ initial_state_id: id })}
                onCreation={(id, allow) =>
                  void perform(() =>
                    store.service.setCreation(workspaceSlug, projectId, id, allow, workflowId, workflow.version)
                  )
                }
                onDelete={(id) =>
                  void perform(() =>
                    store.service.deleteTransition(workspaceSlug, projectId, id, workflowId, workflow.version)
                  )
                }
              />
              <WorkflowRuleEditor
                draft={draft}
                onChange={setDraft}
                onSave={saveRule}
                workflow={workflow}
                projectId={projectId}
                workspaceSlug={workspaceSlug}
                busy={busy}
              />
            </div>
          ) : (
            <p className="mt-6 text-body-xs-regular text-secondary">{t("web.workflow_ui.load_failed")}</p>
          )}
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
      )}
    </SettingsContentWrapper>
  );
});
