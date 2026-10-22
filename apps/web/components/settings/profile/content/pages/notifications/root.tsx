import { useState } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { WorkspaceService } from "@plane/services";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { ProjectService } from "@/services/project";
import { FeishuAccount } from "./feishu-account";
import { NotificationPreferencesForm } from "./preferences-form";

const workspaceService = new WorkspaceService();
const projectService = new ProjectService();
const selectClass = "min-w-0 rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-13 text-primary";

export function NotificationsProfileSettings() {
  const { t } = useTranslation();
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const {
    data: workspaces,
    error: workspaceError,
    mutate: reloadWorkspaces,
  } = useSWR("NOTIFICATION_WORKSPACES", () => workspaceService.list());
  const workspace = workspaces?.find((item) => item.id === workspaceId);
  const {
    data: projects,
    error: projectError,
    mutate: reloadProjects,
  } = useSWR(workspace ? ["NOTIFICATION_PROJECTS", workspace.slug] : null, () =>
    projectService.getProjectsLite(workspace!.slug)
  );
  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("notification_preferences.title")}
        description={t("notification_preferences.description")}
      />
      <div className="mt-7 space-y-7">
        <FeishuAccount />
        <section className="space-y-4" aria-label={t("notification_preferences.events_title")}>
          <h3 className="text-16 font-medium">{t("notification_preferences.events_title")}</h3>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-col gap-1 text-13">
              {t("notification_preferences.workspace")}
              <select
                className={selectClass}
                value={workspaceId}
                onChange={(e) => {
                  setWorkspaceId(e.target.value);
                  setProjectId("");
                }}
              >
                <option value="">{t("notification_preferences.global")}</option>
                {workspaces?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {workspace && (
              <label className="flex min-w-0 flex-col gap-1 text-13">
                {t("notification_preferences.project")}
                <select
                  className={selectClass}
                  disabled={!projects || !!projectError}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">{t("notification_preferences.workspace_defaults")}</option>
                  {projects?.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {(workspaceError || projectError) && (
            <div role="alert" className="text-13">
              {t("notification_preferences.load_error")}
              <Button
                stretch="auto"
                variant="secondary"
                size="sm"
                label={t("notification_preferences.retry")}
                onClick={() => {
                  if (workspaceError) void reloadWorkspaces();
                  if (projectError) void reloadProjects();
                }}
              />
            </div>
          )}
          <NotificationPreferencesForm
            key={`${workspaceId}:${projectId}`}
            scope={workspaceId ? { workspace_id: workspaceId, ...(projectId ? { project_id: projectId } : {}) } : {}}
          />
        </section>
      </div>
    </div>
  );
}
