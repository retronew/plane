import { useState } from "react";
import { observer } from "mobx-react";
import { Link, useParams } from "react-router";
import { History, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { WorkflowsOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InputField } from "@makeplane/propel/components/input-field";
import { Switch } from "@makeplane/propel/components/switch";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow, TWorkflowImpact, TWorkflowImpactRequest } from "@plane/types";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
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
                  component={
                    <BreadcrumbLink label={name} icon={<WorkflowsOutline className="size-4 text-tertiary" />} />
                  }
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
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {detail && canManage && workflow?.workflow_id && (
              <Link
                className="inline-flex items-center gap-2 rounded px-2 py-1 text-body-xs-medium text-accent-primary hover:underline"
                to={`/${workspaceSlug}/settings/projects/${projectId}/runner/?tab=executions&workflow_id=${workflow.workflow_id}`}
              >
                <History className="size-3.5" />
                {t("web.workflow_runner.view_executions")}
              </Link>
            )}
            <Link
              className="ml-auto rounded px-2 py-1 text-body-xs-medium text-accent-primary hover:underline"
              to={`/${workspaceSlug}/settings/projects/${projectId}/issue-types/`}
            >
              {t("web.workflow_ui.issue_types")}
            </Link>
          </div>
          {!detail ? (
            <div className="mt-6 space-y-6">
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
              <div className="flex flex-wrap gap-2">
                <InputField
                  orientation="vertical"
                  size="md"
                  aria-label={t("web.workflow_ui.search")}
                  placeholder={t("web.workflow_ui.search")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select
                  className="rounded border border-subtle bg-layer-1 px-2 text-body-xs-regular"
                  aria-label={t("web.workflow_ui.filter_state")}
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                >
                  <option value="">{t("web.workflow_ui.all_states")}</option>
                  {[
                    ...new Map(workflows.flatMap((item) => item.states).map((state) => [state.id, state])).values(),
                  ].map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-subtle bg-layer-1 px-2 text-body-xs-regular"
                  aria-label={t("web.workflow_ui.filter_type")}
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="">{t("web.workflow_ui.all_types")}</option>
                  {store.issueTypes[projectId]?.results.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border border-subtle bg-layer-1 px-2 text-body-xs-regular"
                  aria-label={t("common.sort.label")}
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="name">{t("web.workflow_ui.sort_name")}</option>
                  <option value="-name">{t("web.workflow_ui.sort_name_desc")}</option>
                  <option value="status">{t("web.workflow_ui.columns.status")}</option>
                </select>
                {canManage && (
                  <Button
                    stretch="auto"
                    variant="primary"
                    size="sm"
                    icon={<Plus className="size-3.5" />}
                    label={t("web.workflow_ui.new_workflow")}
                    onClick={() => setMetadata("new")}
                  />
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-subtle">
                <table className="w-full text-left text-body-xs-regular">
                  <thead className="bg-layer-1 text-tertiary">
                    <tr>
                      {["name", "status", "states", "applies_to"].map((key) => (
                        <th key={key} className="px-4 py-2 font-medium">
                          {t(`web.workflow_ui.columns.${key}`)}
                        </th>
                      ))}
                      <th>
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
                          {t(item.is_active ? "web.workflow_ui.active" : "web.workflow_ui.inactive")}
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
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <IconButton
                              variant="ghost"
                              size="sm"
                              icon={<History className="size-3.5" />}
                              aria-label={t("workflows.quick_actions.view_change_history")}
                              onClick={() => setHistoryId(item.workflow_id ?? item.id)}
                            />
                            {canManage && (
                              <>
                                <IconButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  icon={item.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                                  aria-label={t(
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
                                <IconButton
                                  variant="ghost"
                                  size="sm"
                                  icon={<Pencil className="size-3.5" />}
                                  aria-label={t("edit")}
                                  onClick={() => setMetadata(item)}
                                />
                                {!item.is_default && item.id !== "default" && (
                                  <IconButton
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    icon={<Trash2 className="size-3.5" />}
                                    aria-label={t("delete")}
                                    onClick={() =>
                                      void preview({ operation: "delete", workflow_id: item.workflow_id ?? item.id })
                                    }
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                      onClick={() => setMetadata(workflow)}
                    />
                  )}
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={<History className="size-3.5" />}
                    aria-label={t("workflows.quick_actions.view_change_history")}
                    onClick={() => setHistoryId(workflowId)}
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
          {historyId && (
            <WorkflowHistory
              open
              onClose={() => setHistoryId(null)}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              workflowId={historyId}
            />
          )}
          {metadata && (
            <WorkflowMetadata
              workflow={metadata === "new" ? undefined : metadata}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              onClose={() => setMetadata(null)}
              onPreview={(request) => {
                setMetadata(null);
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
              onClose={() => setImpact(null)}
              onApplied={() => setImpact(null)}
            />
          )}
        </>
      )}
    </SettingsContentWrapper>
  );
});
