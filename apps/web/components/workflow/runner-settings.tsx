import { observer } from "mobx-react";
import { useParams, useSearchParams } from "react-router";
import { Code2 } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import { useTranslation } from "@plane/i18n";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { WorkflowExecutions, WorkflowRunner } from "./runner";

export const WorkflowRunnerSettings = observer(function WorkflowRunnerSettings() {
  const { workspaceSlug = "", projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useProjectWorkflow(projectId);
  const { t } = useTranslation();
  const access = store.lists[projectId] ?? store.workflows[projectId];
  const workflowId = searchParams.get("workflow_id") || undefined;
  const executions = searchParams.get("tab") === "executions" || (!!workflowId && !searchParams.has("tab"));
  const workflow = store.lists[projectId]?.results.find((item) => (item.workflow_id ?? item.id) === workflowId);
  const label = t("web.workflow_runner.scripts");
  const selectTab = (tab: "scripts" | "executions") => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };
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
        <output className="mt-8 block rounded-lg border border-subtle p-6 text-body-xs-regular text-secondary">
          {store.errors[projectId] ? (
            <>
              <p>{t("web.workflow_ui.load_failed")}</p>
              <Button stretch="auto" variant="ghost" size="md" label={t("common.retry")} onClick={retry} />
            </>
          ) : (
            t("loading")
          )}
        </output>
      ) : !access.can_manage ? (
        <p className="mt-6 text-body-sm-regular text-secondary">
          {t("you_do_not_have_the_permission_to_access_this_page")}
        </p>
      ) : (
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
                      name: workflow?.name || (workflow?.is_default ? t("web.workflow_ui.default_name") : workflowId),
                    })}
                  </span>
                  <Button
                    stretch="auto"
                    variant="ghost"
                    size="sm"
                    label={t("web.workflow_runner.show_all_executions")}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete("workflow_id");
                      next.set("tab", "executions");
                      setSearchParams(next);
                    }}
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
      )}
    </SettingsContentWrapper>
  );
});
