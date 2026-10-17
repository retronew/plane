import { useState } from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { useParams } from "react-router";
import { Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InputField } from "@makeplane/propel/components/input-field";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TProjectIssueType, TWorkflowImpact, TWorkflowImpactRequest } from "@plane/types";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { PageHead } from "@/components/core/page-title";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { useIssues } from "@/hooks/store/use-issues";
import { getWorkflowErrorCode } from "@/helpers/workflow";
import { WorkflowImpactDialog } from "./impact-dialog";

export const IssueTypesSettings = observer(function IssueTypesSettings() {
  const { workspaceSlug = "", projectId = "" } = useParams(),
    store = useProjectWorkflow(projectId),
    { t } = useTranslation();
  const { issueMap } = useIssues();
  const types = store.issueTypes[projectId],
    [draft, setDraft] = useState<Partial<TProjectIssueType> | null>(null),
    [busy, setBusy] = useState(false),
    [impact, setImpact] = useState<{ request: TWorkflowImpactRequest; preview: TWorkflowImpact } | null>(null);
  const errorToast = (error: unknown) => {
    const code = getWorkflowErrorCode(error);
    setToast({
      type: "error",
      title: t("error"),
      message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed"),
    });
  };
  const preview = async (request: TWorkflowImpactRequest) => {
    setBusy(true);
    try {
      setImpact({ request, preview: await store.service.preview(workspaceSlug, projectId, request) });
    } catch (error) {
      errorToast(error);
    } finally {
      setBusy(false);
    }
  };
  const save = async (data: Partial<TProjectIssueType>, id?: string) => {
    setBusy(true);
    try {
      const saved = await store.service.saveType(
        workspaceSlug,
        projectId,
        { ...data, version: types?.policy_version },
        id
      );
      if (id && saved.id !== id)
        runInAction(() => {
          for (const issue of Object.values(issueMap))
            if (issue.project_id === projectId && issue.type_id === id) issue.type_id = saved.id;
        });
      await store.refresh(workspaceSlug, projectId);
      setDraft(null);
    } catch (error) {
      errorToast(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SettingsContentWrapper
      header={
        <SettingsPageHeader
          leftItem={
            <div className="flex items-center gap-2">
              <Shapes className="size-4 text-tertiary" />
              <span>{t("web.workflow_ui.issue_types")}</span>
            </div>
          }
        />
      }
    >
      <PageHead title={`${t("web.workflow_ui.issue_types")} - ${t("settings")}`} />
      <SettingsHeading title={t("web.workflow_ui.issue_types")} description={t("web.workflow_ui.types_description")} />
      {!types ? (
        <p className="mt-6 text-body-xs-regular text-secondary">{t("loading")}</p>
      ) : (
        <div className="mt-6 space-y-4">
          {types.can_manage && (
            <Button
              stretch="auto"
              size="sm"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              label={t("web.workflow_ui.new_type")}
              onClick={() => setDraft({ name: "", description: "", is_active: true })}
            />
          )}
          {draft && (
            <form
              className="space-y-3 rounded-lg border border-subtle p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save({ name: draft.name, description: draft.description, is_default: draft.is_default }, draft.id);
              }}
            >
              <InputField
                orientation="vertical"
                size="md"
                label={t("name")}
                value={draft.name ?? ""}
                disabled={busy}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
              <InputField
                orientation="vertical"
                size="md"
                label={t("description")}
                value={draft.description ?? ""}
                disabled={busy}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
              <label className="flex items-center gap-2 text-body-xs-regular">
                <input
                  type="checkbox"
                  checked={!!draft.is_default}
                  disabled={busy}
                  onChange={(event) => setDraft({ ...draft, is_default: event.target.checked })}
                />
                {t("web.workflow_ui.default_type")}
              </label>
              <div className="flex gap-2">
                <Button
                  stretch="auto"
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={busy || !draft.name?.trim()}
                  label={t("save")}
                />
                <Button
                  stretch="auto"
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  label={t("cancel")}
                  onClick={() => setDraft(null)}
                />
              </div>
            </form>
          )}
          <div className="divide-y divide-subtle rounded-lg border border-subtle">
            {types.results.map((type) => (
              <div key={type.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-body-xs-regular">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-primary">
                    {type.name}
                    {type.is_default && (
                      <span className="ml-2 text-caption-md-regular text-accent-primary">{t("common.default")}</span>
                    )}
                  </p>
                  {type.description && <p className="text-secondary">{type.description}</p>}
                </div>
                <label className="text-secondary">
                  {t("common.workflows")}
                  <select
                    className="ml-2 rounded border border-subtle bg-layer-1 p-2 text-primary"
                    value={type.workflow_id ?? ""}
                    disabled={busy || !types.can_manage}
                    onChange={(event) =>
                      void preview({
                        operation: "bind_type",
                        type_id: type.id,
                        workflow_id: event.target.value || undefined,
                      })
                    }
                  >
                    <option value="">{t("web.workflow_ui.default_name")}</option>
                    {store.lists[projectId]?.results
                      .filter((item) => !item.is_default)
                      .map((workflow) => (
                        <option key={workflow.id} value={workflow.workflow_id ?? workflow.id}>
                          {workflow.name}
                        </option>
                      ))}
                  </select>
                </label>
                {types.can_manage && (
                  <>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={t("edit")}
                      icon={<Pencil className="size-3.5" />}
                      onClick={() => setDraft(type)}
                    />
                    <IconButton
                      size="sm"
                      variant="ghost"
                      disabled={busy || type.is_default}
                      aria-label={t("delete")}
                      icon={<Trash2 className="size-3.5" />}
                      onClick={() => void preview({ operation: "remove_type", type_id: type.id })}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {impact && (
        <WorkflowImpactDialog
          key={impact.preview.token}
          request={impact.request}
          impact={impact.preview}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          onClose={() => setImpact(null)}
          onApplied={() => setImpact(null)}
        />
      )}
    </SettingsContentWrapper>
  );
});
