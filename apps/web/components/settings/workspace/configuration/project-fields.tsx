import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { configurationKey, workspaceConfigurationService as service } from "@/services/workspace-configuration.service";
import type { ProjectCategory } from "@/services/workspace-configuration.service";
import { ConfigurationSelect } from "./select";

export function useProjectCategories(slug: string) {
  const { data: stateSettings } = useSWR(`project-state-settings:${slug}`, () => service.stateSettings(slug));
  const statuses = useSWR(slug ? configurationKey(slug, "project-categories/status") : null, () =>
    service.list<ProjectCategory>(slug, "project-categories/status")
  );
  const labels = useSWR(slug ? configurationKey(slug, "project-categories/label") : null, () =>
    service.list<ProjectCategory>(slug, "project-categories/label")
  );
  return {
    statuses: stateSettings?.enabled ? (statuses.data ?? []) : [],
    statesEnabled: stateSettings?.enabled ?? false,
    labels: labels.data ?? [],
    error: statuses.error || labels.error,
  };
}
export function ProjectCategoryFields({
  workspaceSlug,
  status,
  labels,
  onStatus,
  onLabels,
  disabled = false,
}: {
  workspaceSlug: string;
  status?: string | null;
  labels?: string[];
  onStatus: (id: string | null) => void;
  onLabels: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const categories = useProjectCategories(workspaceSlug);
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {categories.statesEnabled && (
        <div className="flex flex-col gap-2">
          <span className="text-13">{t("web.project_statuses")}</span>
          <ConfigurationSelect
            placeholder={t("web.no_project_status")}
            value={status ?? categories.statuses.find((entry) => entry.is_default)?.id ?? ""}
            disabled={disabled || !!categories.error}
            options={categories.statuses.map((entry) => ({ value: entry.id, label: entry.name }))}
            onChange={onStatus}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-13">{t("web.project_labels")}</span>
        <div className="flex flex-wrap gap-2">
          {categories.labels.map((entry) => (
            <Checkbox
              key={entry.id}
              label={entry.name}
              disabled={disabled}
              checked={labels?.includes(entry.id) ?? false}
              onCheckedChange={(checked) =>
                onLabels(
                  checked ? [...new Set([...(labels ?? []), entry.id])] : (labels ?? []).filter((id) => id !== entry.id)
                )
              }
            />
          ))}
          {!categories.labels.length && <span className="text-12 text-tertiary">{t("web.configuration_empty")}</span>}
        </div>
      </div>
      {categories.error && <p className="text-12 text-danger-primary">{t("web.configuration_load_error")}</p>}
    </div>
  );
}
export function ProjectCategoryBadges({
  workspaceSlug,
  status,
  labels,
}: {
  workspaceSlug: string;
  status?: string | null;
  labels?: string[];
}) {
  const categories = useProjectCategories(workspaceSlug);
  const entries = [
    ...categories.statuses.filter((e) => e.id === status),
    ...categories.labels.filter((e) => labels?.includes(e.id)),
  ];
  if (!entries.length) return null;
  return (
    <div className="flex gap-1 overflow-hidden">
      {entries.map((entry) => (
        <span
          key={entry.id}
          className="flex max-w-28 shrink-0 items-center gap-1 rounded border border-subtle px-1.5 py-0.5 text-11"
        >
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="truncate">{entry.name}</span>
        </span>
      ))}
    </div>
  );
}
