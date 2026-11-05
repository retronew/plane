import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { Select } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import { WorkspaceService } from "@plane/services";
import type { TDailyDigestSettings, TDailyDigestSettingsPatch } from "@plane/types";
import { ProjectService } from "@/services/project";

const workspaceService = new WorkspaceService();
const projectService = new ProjectService();
type ScopeOption = { id: string; name: string };

function ScopeSelect({
  label,
  options,
  ids,
  disabled,
  allLabel,
  onChange,
}: {
  label: string;
  options: ScopeOption[];
  ids: string[];
  disabled: boolean;
  allLabel: string;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-13 font-medium text-primary">{label}</p>
      <Select<ScopeOption>
        lazyMount={false}
        placeholder={label}
        multiple
        getValues={() => options}
        valueIds={ids}
        getOptionPlaceholder={(id) => ({ id, name: id })}
        getOptionValue={(option) => option.id}
        getOptionLabel={(option) => option.name}
        onChange={onChange}
        disabled={disabled}
      >
        <Select.Trigger<ScopeOption> variant="select-md" className="w-full" aria-label={label}>
          {(selected) => (
            <span className="min-w-0 flex-1 truncate text-left">
              {selected.length
                ? t("notification_preferences.digest.selected_count", { count: selected.length })
                : allLabel}
            </span>
          )}
        </Select.Trigger>
      </Select>
    </div>
  );
}

export function DigestScope({
  settings,
  disabled,
  onChange,
}: {
  settings: TDailyDigestSettings;
  disabled: boolean;
  onChange: (patch: TDailyDigestSettingsPatch) => void;
}) {
  const { t } = useTranslation();
  const {
    data: workspaces,
    error: workspaceError,
    mutate: reloadWorkspaces,
  } = useSWR("NOTIFICATION_WORKSPACES", () => workspaceService.list());
  const selectedWorkspaceIds = new Set(settings.workspace_ids);
  const scopeWorkspaces = workspaces?.filter(
    (workspace) => selectedWorkspaceIds.size === 0 || selectedWorkspaceIds.has(workspace.id)
  );
  const scopeKey = scopeWorkspaces?.map((workspace) => workspace.slug).join(",");
  const {
    data: projects,
    error: projectError,
    mutate: reloadProjects,
  } = useSWR(workspaces ? ["DAILY_DIGEST_PROJECTS", scopeKey] : null, async () => {
    const groups = await Promise.all(
      (scopeWorkspaces ?? []).map(async (workspace) => {
        const entries = await projectService.getProjectsLite(workspace.slug);
        return entries.map((project) => ({ id: project.id, name: `${workspace.name} / ${project.name}` }));
      })
    );
    return groups.flat();
  });
  return (
    <div className="space-y-3">
      <p className="text-12 leading-5 text-secondary">{t("notification_preferences.digest.scope_note")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ScopeSelect
          label={t("notification_preferences.workspace")}
          options={workspaces?.map((workspace) => ({ id: workspace.id, name: workspace.name })) ?? []}
          ids={settings.workspace_ids}
          disabled={disabled || !workspaces || !!workspaceError}
          allLabel={t("notification_preferences.digest.all_workspaces")}
          onChange={(workspace_ids) => onChange({ workspace_ids, project_ids: [] })}
        />
        <ScopeSelect
          label={t("notification_preferences.project")}
          options={projects ?? []}
          ids={settings.project_ids}
          disabled={disabled || !projects || !!projectError}
          allLabel={t("notification_preferences.digest.all_projects")}
          onChange={(project_ids) => onChange({ project_ids })}
        />
      </div>
      {(workspaceError || projectError) && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-13 text-secondary">
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
    </div>
  );
}
