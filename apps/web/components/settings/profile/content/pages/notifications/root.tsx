import { useState } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectList,
  SelectTrigger,
} from "@makeplane/propel/components/select";
import { useTranslation } from "@plane/i18n";
import { WorkspaceService } from "@plane/services";
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { ProjectService } from "@/services/project";
import { FeishuAccount } from "./feishu-account";
import { NotificationPreferencesForm } from "./preferences-form";

const workspaceService = new WorkspaceService();
const projectService = new ProjectService();

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
  const workspaceOptions = [
    { value: "", label: t("notification_preferences.global") },
    ...(workspaces?.map((item) => ({ value: item.id, label: item.name })) ?? []),
  ];
  const projectOptions = [
    { value: "", label: t("notification_preferences.workspace_defaults") },
    ...(projects?.map((project) => ({ value: project.id, label: project.name })) ?? []),
  ];
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
            <div className="flex min-w-0 flex-col gap-1">
              <Select<string>
                items={workspaceOptions}
                value={workspaceId}
                onValueChange={(value) => {
                  if (value === null) return;
                  setWorkspaceId(value);
                  setProjectId("");
                }}
              >
                <SelectLabel size="md">{t("notification_preferences.workspace")}</SelectLabel>
                <SelectTrigger size="md" width="fit" />
                <SelectContent>
                  <SelectList>
                    {workspaceOptions.map((option) => (
                      <SelectItem key={option.value} {...option} size="md" />
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </div>
            {workspace && (
              <div className="flex min-w-0 flex-col gap-1">
                <Select<string>
                  items={projectOptions}
                  disabled={!projects || !!projectError}
                  value={projectId}
                  onValueChange={(value) => {
                    if (value !== null) setProjectId(value);
                  }}
                >
                  <SelectLabel size="md">{t("notification_preferences.project")}</SelectLabel>
                  <SelectTrigger size="md" width="fit" />
                  <SelectContent>
                    <SelectList>
                      {projectOptions.map((option) => (
                        <SelectItem key={option.value} {...option} size="md" />
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </div>
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
