import useSWR from "swr";
import { LabelSelect } from "@plane/blocks/property-select";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import { ProjectStatusIcon } from "@/components/project/project-status-icon";
import type { ReactNode } from "react";
import { Select } from "@plane/blocks/select";
import { PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME } from "@/components/project/create/attribute-styles";
import { useTranslation } from "@plane/i18n";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { configurationKey, workspaceConfigurationService as service } from "@/services/workspace-configuration.service";
import type { ProjectCategory } from "@/services/workspace-configuration.service";

const statusIcon = (entry: ProjectCategory) => <ProjectStatusIcon group={entry.group} color={entry.color} />;
const selectedStatusIcon = (entries: ProjectCategory[]) => (entries[0] ? statusIcon(entries[0]) : undefined);

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
    refreshLabels: labels.mutate,
  };
}
export function ProjectCategoryFields({
  workspaceSlug,
  status,
  labels,
  onStatus,
  onLabels,
  disabled = false,
  compact = false,
  children,
}: {
  workspaceSlug: string;
  status?: string | null;
  labels?: string[];
  onStatus: (id: string | null) => void;
  onLabels: (ids: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const categories = useProjectCategories(workspaceSlug);
  const { allowPermissions } = useUserPermissions();
  const canCreateLabel = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  if (compact) {
    const selectedStatus =
      categories.statuses.find((entry) => entry.id === status) ??
      (!status ? categories.statuses.find((entry) => entry.is_default) : undefined) ??
      null;
    return (
      <>
        {categories.statesEnabled && (
          <Select<ProjectCategory>
            getValues={() => categories.statuses}
            value={selectedStatus}
            onChange={onStatus}
            getOptionValue={(entry) => entry.id}
            getOptionLabel={(entry) => entry.name}
            getOptionIcon={statusIcon}
            disabled={disabled || Boolean(categories.error)}
            placeholder={t("state")}
            showSearch
          >
            <Select.Trigger<ProjectCategory>
              variant="pill-md"
              className={PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME}
              aria-label={t("state")}
              prependIcon={selectedStatusIcon}
            >
              {(entries) => entries[0]?.name ?? t("state")}
            </Select.Trigger>
          </Select>
        )}
        {children}
        <LabelSelect
          getValues={async ({ search }) => ({
            results: categories.labels.filter((entry) =>
              entry.name.toLocaleLowerCase().includes(search?.trim().toLocaleLowerCase() ?? "")
            ),
            next_page_results: false,
          })}
          value={(labels ?? []).map((id) => categories.labels.find((entry) => entry.id === id) ?? { id, name: id })}
          onChange={onLabels}
          disabled={disabled || Boolean(categories.error)}
          placeholder={t("labels")}
          variant="pill-md"
          className={PROJECT_ATTRIBUTE_TRIGGER_CLASS_NAME}
          createLabel={{
            canCreate: canCreateLabel,
            onCreate: async (name) => {
              const created = await service.save<ProjectCategory>(workspaceSlug, "project-categories/label", {
                name: name.trim(),
                color: "#60646C",
              });
              await categories.refreshLabels(
                (entries: ProjectCategory[] | undefined) => [
                  ...(entries ?? []).filter((entry) => entry.id !== created.id),
                  created,
                ],
                { revalidate: false }
              );
              return created;
            },
          }}
        />
      </>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {categories.statesEnabled && (
        <div className="flex flex-col gap-2">
          <span className="text-13">{t("web.project_statuses")}</span>
          <Select<ProjectCategory>
            getValues={() => categories.statuses}
            value={
              categories.statuses.find(
                (entry) => entry.id === (status ?? categories.statuses.find((item) => item.is_default)?.id)
              ) ?? null
            }
            disabled={disabled || !!categories.error}
            getOptionValue={(entry) => entry.id}
            getOptionLabel={(entry) => entry.name}
            getOptionIcon={statusIcon}
            placeholder={t("web.no_project_status")}
            onChange={onStatus}
            showSearch
            pinSelected={false}
          >
            <Select.Trigger<ProjectCategory>
              variant="select-lg"
              prependIcon={selectedStatusIcon}
              aria-label={t("web.project_statuses")}
            >
              {(entries) => entries[0]?.name ?? t("web.no_project_status")}
            </Select.Trigger>
          </Select>
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
