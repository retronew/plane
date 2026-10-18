import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { runInAction } from "mobx";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { WorkItemsOutline, PropertiesOutline, HierarchyOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { Badge } from "@makeplane/propel/components/badge";
import { Tabs, Tab, TabsList, TabsPanel } from "@makeplane/propel/components/tabs";
import { TypesLogo } from "./types-logo";
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
import { TypesEditor } from "./types-editor";
import { TypesActions } from "./types-actions";
import { TypesList } from "./types-list";
import { TypesHierarchy } from "./types-hierarchy";
import { WorkItemPropertiesSettings } from "./types-properties-settings";

const key = "web.workflow_ui.types_settings";
const logo = (type: TProjectIssueType) => <TypesLogo type={type} />;
export const IssueTypesSettings = observer(function IssueTypesSettings() {
  const { workspaceSlug = "", projectId = "", typeId } = useParams();
  const store = useProjectWorkflow(projectId),
    { t } = useTranslation(),
    { issueMap } = useIssues();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = ["properties", "hierarchy"].includes(params.get("tab") ?? "") ? params.get("tab")! : "types";
  const types = store.issueTypes[projectId];
  const [draft, setDraft] = useState<Partial<TProjectIssueType> | null>(null),
    [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false),
    [loadError, setLoadError] = useState(false),
    [loading, setLoading] = useState(true);
  const [impact, setImpact] = useState<{ request: TWorkflowImpactRequest; preview: TWorkflowImpact } | null>(null),
    [impactOpen, setImpactOpen] = useState(false);
  useEffect(() => {
    let current = true;
    Promise.all([store.fetchTypes(workspaceSlug, projectId), store.fetchList(workspaceSlug, projectId)])
      .catch(() => {
        if (current) setLoadError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [store, workspaceSlug, projectId]);
  const retry = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      await store.refresh(workspaceSlug, projectId);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  const errorToast = (error: unknown) => {
    const code = getWorkflowErrorCode(error);
    setToast({
      type: "error",
      title: t("error"),
      message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed"),
    });
  };
  const preview = async (request: TWorkflowImpactRequest) => {
    if (busy || !types?.can_manage) return;
    setBusy(true);
    try {
      setImpact({ request, preview: await store.service.preview(workspaceSlug, projectId, request) });
      setImpactOpen(true);
    } catch (error) {
      errorToast(error);
    } finally {
      setBusy(false);
    }
  };
  const save = async (data: Partial<TProjectIssueType>, id?: string): Promise<TProjectIssueType | false> => {
    if (busy || !types?.can_manage) return false;
    const original = types.results.find((type) => type.id === id);
    if (original?.is_default && data.is_active === false) return false;
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
      if (id && saved.id !== id && typeId === id)
        void navigate(
          `/${workspaceSlug}/settings/projects/${projectId}/work-item-types/types/${saved.id}/properties/`,
          { replace: true }
        );
      setEditorOpen(false);
      return saved;
    } catch (error) {
      errorToast(error);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const edit = (type: Partial<TProjectIssueType>) => {
    if (busy || !types?.can_manage) return;
    setDraft(type);
    setEditorOpen(true);
  };
  const base = `/${workspaceSlug}/settings/projects/${projectId}/work-item-types/`;
  const selected = types?.results.find((type) => type.id === typeId);
  const badge = (type: TProjectIssueType) =>
    type.is_default ? <Badge size="xs" variant="neutral" label={t("common.default")} /> : null;
  const renderPanel = () => {
    if (loadError)
      return (
        <div role="alert" className="space-y-3 py-6">
          <p className="text-body-xs-regular text-secondary">{t("web.workflow_ui.load_failed")}</p>
          <Button
            stretch="auto"
            size="sm"
            variant="secondary"
            label={t("web.retry")}
            disabled={loading}
            onClick={() => void retry()}
          />
        </div>
      );
    if (!types) return <p className="py-6 text-body-xs-regular text-secondary">{t("loading")}</p>;
    if (typeId && !selected) return <p className="py-6 text-body-xs-regular text-secondary">{t(`${key}.not_found`)}</p>;
    if (typeId || tab === "properties")
      return (
        <WorkItemPropertiesSettings
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          types={types.results}
          typeId={selected?.id}
          onChanged={() => store.fetchTypes(workspaceSlug, projectId)}
        />
      );
    if (tab === "hierarchy") return <TypesHierarchy types={types.results} base={base} />;
    return (
      <TypesList
        types={types.results}
        workflows={store.lists[projectId]?.results ?? []}
        canManage={types.can_manage}
        busy={busy}
        base={base}
        onEdit={edit}
        onSave={save}
        onPreview={preview}
      />
    );
  };
  return (
    <SettingsContentWrapper
      header={
        <SettingsPageHeader
          breadcrumbs={[
            {
              label: t("web.workflow_ui.issue_types"),
              href: base,
              icon: <WorkItemsOutline className="size-4 text-tertiary" />,
            },
            ...(selected ? [{ label: selected.name }] : []),
          ]}
        />
      }
    >
      <PageHead title={`${selected?.name ?? t("web.workflow_ui.issue_types")} - ${t("settings")}`} />
      {selected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {logo(selected)}
            <h3 className="text-h3-medium text-primary">{selected.name}</h3>
            {badge(selected)}
            <div className="ml-auto">
              <TypesActions
                type={selected}
                workflows={store.lists[projectId]?.results ?? []}
                canManage={types?.can_manage ?? false}
                busy={busy}
                onEdit={edit}
                onSave={save}
                onPreview={preview}
              />
            </div>
          </div>
          <p className="text-body-xs-regular text-secondary">{selected.description}</p>
        </div>
      ) : (
        <SettingsHeading
          title={t("web.workflow_ui.issue_types")}
          description={t("web.workflow_ui.types_description")}
        />
      )}
      <div className="mt-6">
        <Tabs
          variant="underline"
          value={typeId ? "properties" : tab}
          onValueChange={(value) => {
            if (!typeId && typeof value === "string")
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.set("tab", value);
                return next;
              });
          }}
        >
          <div className="w-full min-w-0 border-b border-subtle-1">
            <TabsList aria-label={t("web.workflow_ui.issue_types")}>
              {(typeId ? ["properties"] : ["types", "properties", "hierarchy"]).map((value) => (
                <Tab
                  key={value}
                  value={value}
                  icon={
                    value === "types" ? (
                      <WorkItemsOutline className="size-4 text-tertiary" />
                    ) : value === "properties" ? (
                      <PropertiesOutline className="size-4 text-tertiary" />
                    ) : (
                      <HierarchyOutline className="size-4 text-tertiary" />
                    )
                  }
                  label={t(value === "types" ? "web.workflow_ui.issue_types" : `${key}.${value}`)}
                />
              ))}
            </TabsList>
          </div>
          <div className="w-full min-w-0 pt-3">
            <TabsPanel value={typeId ? "properties" : tab}>{renderPanel()}</TabsPanel>
          </div>
        </Tabs>
      </div>
      {draft && (
        <TypesEditor
          key={draft.id ?? "new"}
          type={draft}
          open={editorOpen}
          busy={busy}
          onClose={() => setEditorOpen(false)}
          onClosed={() => setDraft(null)}
          onSave={save}
        />
      )}
      {impact && (
        <WorkflowImpactDialog
          key={impact.preview.token}
          open={impactOpen}
          request={impact.request}
          impact={impact.preview}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          onClose={() => setImpactOpen(false)}
          onApplied={() => setImpactOpen(false)}
          onOpenChangeComplete={(open) => {
            if (!open) setImpact(null);
          }}
        />
      )}
    </SettingsContentWrapper>
  );
});
