import { workflowDisplayName } from "./display-name";
import { observer } from "mobx-react";
import { useParams, useSearchParams } from "react-router";
import { Code2 } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { useTranslation } from "@plane/i18n";
import type { TProjectWorkflow } from "@plane/types";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { WorkflowExecutions, WorkflowRunner } from "./runner";

type RunnerTab = "scripts" | "executions";

function resolveActiveTab(searchParams: URLSearchParams, workflowId?: string): RunnerTab {
  if (searchParams.get("tab") === "executions") return "executions";
  if (workflowId && !searchParams.has("tab")) return "executions";
  return "scripts";
}

function resolveWorkflowName(
  workflow: TProjectWorkflow | undefined,
  workflowId: string,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  if (workflow?.name || workflow?.is_default) return workflowDisplayName(workflow, t("web.workflow_ui.default_name"));
  return workflowId;
}

function RunnerLoadState({ hasError, onRetry }: { hasError: boolean; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <output className="mt-8 block rounded-lg border border-subtle p-6 text-body-xs-regular text-secondary">
      {hasError ? (
        <>
          <p>{t("web.workflow_ui.load_failed")}</p>
          <Button stretch="auto" variant="ghost" size="md" label={t("common.retry")} onClick={onRetry} />
        </>
      ) : (
        t("loading")
      )}
    </output>
  );
}

function RunnerTabs({
  workspaceSlug,
  projectId,
  label,
  workflowId,
  workflow,
  activeTab,
  searchParams,
  setSearchParams,
}: {
  workspaceSlug: string;
  projectId: string;
  label: string;
  workflowId?: string;
  workflow: TProjectWorkflow | undefined;
  activeTab: RunnerTab;
  searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams) => void;
}) {
  const { t } = useTranslation();
  const executions = activeTab === "executions";
  const selectTab = (tab: RunnerTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };
  const clearWorkflow = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("workflow_id");
    next.set("tab", "executions");
    setSearchParams(next);
  };

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label={label}>
        <Button
          role="tab"
          aria-selected={!executions}
          stretch="auto"
          variant={executions ? "ghost" : "secondary"}
          size="sm"
          label={t("web.workflow_runner.scripts_tab")}
          onClick={() => selectTab("scripts")}
        />
        <Button
          role="tab"
          aria-selected={executions}
          stretch="auto"
          variant={executions ? "secondary" : "ghost"}
          size="sm"
          label={t("web.workflow_runner.executions")}
          onClick={() => selectTab("executions")}
        />
      </div>
      {executions ? (
        <div className="mt-6 space-y-4">
          {workflowId && (
            <div className="flex flex-wrap items-center gap-2 text-body-xs-regular text-secondary">
              <span>
                {t("web.workflow_runner.workflow_filter", {
                  name: resolveWorkflowName(workflow, workflowId, t),
                })}
              </span>
              <Button
                stretch="auto"
                variant="ghost"
                size="sm"
                label={t("web.workflow_runner.show_all_executions")}
                onClick={clearWorkflow}
              />
            </div>
          )}
          <WorkflowExecutions
            key={`${projectId}:${workflowId ?? "all"}`}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            workflowId={workflowId}
          />
        </div>
      ) : (
        <WorkflowRunner key={projectId} workspaceSlug={workspaceSlug} projectId={projectId} />
      )}
    </>
  );
}

export const WorkflowRunnerSettings = observer(function WorkflowRunnerSettings() {
  const { workspaceSlug = "", projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useProjectWorkflow(projectId);
  const { t } = useTranslation();
  const access = store.lists[projectId] ?? store.workflows[projectId];
  const workflowId = searchParams.get("workflow_id") || undefined;
  const activeTab = resolveActiveTab(searchParams, workflowId);
  const workflow = store.lists[projectId]?.results.find((item) => (item.workflow_id ?? item.id) === workflowId);
  const label = t("web.workflow_runner.scripts");
  const retry = () => {
    void store.fetch(workspaceSlug, projectId, true).catch(() => undefined);
    void store.fetchList(workspaceSlug, projectId, true).catch(() => undefined);
  };

  return (
    <SettingsContentWrapper
      header={
        <SettingsPageHeader
          leftItem={
            <Breadcrumbs>
              <Breadcrumbs.Item
                component={<BreadcrumbLink label={label} icon={<Code2 className="size-4 text-tertiary" />} />}
              />
            </Breadcrumbs>
          }
        />
      }
    >
      <PageHead title={`${label} - ${t("settings")}`} />
      <SettingsHeading title={label} description={t("web.workflow_runner.description")} />
      {!access ? (
        <RunnerLoadState hasError={!!store.errors[projectId]} onRetry={retry} />
      ) : !access.can_manage ? (
        <p className="mt-6 text-body-sm-regular text-secondary">
          {t("you_do_not_have_the_permission_to_access_this_page")}
        </p>
      ) : (
        <RunnerTabs
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          label={label}
          workflowId={workflowId}
          workflow={workflow}
          activeTab={activeTab}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
        />
      )}
    </SettingsContentWrapper>
  );
});
