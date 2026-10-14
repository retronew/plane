import { useWorkspace } from "@/hooks/store/use-workspace";
import { useProject } from "@/hooks/store/use-project";
import { useState } from "react";
import { useParams } from "react-router";
import useSWR, { useSWRConfig } from "swr";
import { Switch } from "@makeplane/propel/components/switch";
import { Button } from "@makeplane/propel/components/button";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import { configurationKey, workspaceConfigurationService as service } from "@/services/workspace-configuration.service";
import { CategoryManager } from "./category-manager";
export const PROJECT_PHASES = ["draft", "planning", "execution", "monitoring", "completed", "cancelled"] as const;
export const stateSettingsKey = (slug: string) => `project-state-settings:${slug}`;
export function ProjectStateSettings() {
  const { workspaceSlug = "" } = useParams();
  const { t } = useTranslation();
  const { fetchWorkspaces } = useWorkspace();
  const { fetchProjects } = useProject();
  const { mutate: refresh } = useSWRConfig();
  const { data, error, mutate } = useSWR(stateSettingsKey(workspaceSlug), () => service.stateSettings(workspaceSlug));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-subtle p-4">
        <div>
          <label htmlFor="project-states-enabled" className="text-13 font-medium">
            {t("web.project_states_enable")}
          </label>
          <p className="mt-1 text-13 text-tertiary">{t("web.project_states_enable_hint")}</p>
        </div>
        <Switch
          size="md"
          id="project-states-enabled"
          checked={data?.enabled ?? false}
          disabled={!data || busy}
          onCheckedChange={async (enabled) => {
            setBusy(true);
            setFailed(false);
            try {
              await mutate(await service.setStateSettings(workspaceSlug, enabled), false);
              await refresh(configurationKey(workspaceSlug, "project-categories/status"));
              await Promise.all([fetchWorkspaces(), fetchProjects(workspaceSlug)]);
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {(failed || error) && (
        <div role="alert" className="flex items-center gap-2 text-13 text-danger-primary">
          {t("web.configuration_save_error")}
          <Button
            stretch="auto"
            label={t("common.actions.retry")}
            variant="secondary"
            size="sm"
            onClick={() => void mutate()}
          />
        </div>
      )}
      {data?.enabled
        ? PROJECT_PHASES.map((group) => (
            <div key={group} className="rounded-lg border border-subtle bg-surface-2">
              <div>
                <CategoryManager kind="status" group={group} />
              </div>
            </div>
          ))
        : !error && (
            <EmptyStateCompact
              assetKey="state"
              assetClassName="size-20"
              title={t("web.project_states_enable")}
              description={t("web.project_states_disabled_description")}
            />
          )}
    </div>
  );
}
