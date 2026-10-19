import { useWorkspace } from "@/hooks/store/use-workspace";
import { useProject } from "@/hooks/store/use-project";
import { useState } from "react";
import { useParams } from "react-router";
import useSWR, { useSWRConfig } from "swr";
import { Switch } from "@makeplane/propel/components/switch";
import { Button } from "@makeplane/propel/components/button";
import { SettingsHeading } from "@/components/settings/heading";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import { configurationKey, workspaceConfigurationService as service } from "@/services/workspace-configuration.service";
import { CategoryManager } from "./category-manager";
import { PROJECT_PHASES, stateSettingsKey } from "./project-state-keys";
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
    <div className="flex flex-col gap-12">
      <div className="flex flex-col items-start gap-4 rounded-lg border border-subtle bg-layer-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="project-states-enabled" className="text-body-sm-medium text-primary">
            {t("web.project_states_enable")}
          </label>
          <p className="text-body-2xs-regular text-tertiary">{t("web.project_states_enable_hint")}</p>
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
            label={t("common.retry")}
            variant="secondary"
            size="sm"
            onClick={() => void mutate()}
          />
        </div>
      )}
      <section className="space-y-3" aria-label={t("web.project_states_heading")}>
        <SettingsHeading
          variant="h6"
          title={t("web.project_states_heading")}
          description={t("web.project_statuses_description")}
        />
        {data?.enabled ? (
          <div className="rounded-xl border border-subtle bg-layer-2 p-3">
            {PROJECT_PHASES.map((group) => (
              <div key={group}>
                <div>
                  <CategoryManager kind="status" group={group} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          !error && (
            <EmptyStateCompact
              assetKey="state"
              rootClassName="rounded-lg border border-subtle bg-surface-1 py-10"
              title={t("web.project_states_enable")}
              description={t("web.project_states_disabled_description")}
            />
          )
        )}
      </section>
    </div>
  );
}
