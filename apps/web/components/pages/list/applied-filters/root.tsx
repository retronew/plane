import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CalendarOutline, CloseOutline } from "@makeplane/propel/icons";
import { DATE_BEFORE_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TPageFilterProps } from "@plane/types";
import { calculateTotalFilters, renderFormattedDate } from "@plane/utils";
import { ProjectFilterChip } from "@/components/project/applied-filters/chip";
import { AppliedMembersFilters } from "@/components/project/applied-filters/members";
import { useLabel } from "@/hooks/store/use-label";

type Props = {
  projectId: string;
  appliedFilters: TPageFilterProps;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof TPageFilterProps, value: string | null) => void;
  alwaysAllowEditing?: boolean;
};

// Match the project list's applied-filter groups and reuse its chip and action primitives.
const FILTER_GROUP_CLASSNAME =
  "my-auto flex min-h-7 flex-wrap items-center gap-1.5 rounded-md border border-subtle-1 bg-layer-2 px-2 py-0.5 text-11 text-tertiary";

export const PageAppliedFiltersList = observer(function PageAppliedFiltersList({
  projectId,
  appliedFilters,
  handleClearAllFilters,
  handleRemoveFilter,
  alwaysAllowEditing,
}: Props) {
  const { t } = useTranslation();
  const { getProjectLabels } = useLabel();
  const labels = new Map((getProjectLabels(projectId) ?? []).map((label) => [label.id, label]));
  if (!appliedFilters || calculateTotalFilters(appliedFilters) === 0) return null;

  const filterLabels: Record<keyof TPageFilterProps, string> = {
    favorites: t("web.favorites"),
    created_at: t("web.created_date"),
    created_by: t("web.created_by"),
    labels: t("labels"),
  };
  const dateLabel = (value: string) => {
    const relative = DATE_BEFORE_FILTER_OPTIONS.find((option) => option.value === value);
    if (relative) return relative.name;
    const [date, direction] = value.split(";");
    return `${t(direction === "after" ? "web.after" : "web.before")} ${renderFormattedDate(date)}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {Object.entries(appliedFilters).map(([key, value]) => {
        const filterKey = key as keyof TPageFilterProps;
        if (!value || (Array.isArray(value) && !value.length)) return null;
        return (
          <div key={filterKey} className={FILTER_GROUP_CLASSNAME}>
            <span className="text-11 text-tertiary">{filterLabels[filterKey]}</span>
            <div className="flex flex-wrap items-center gap-1">
              {filterKey === "created_at" &&
                Array.isArray(value) &&
                value.map((date) => (
                  <ProjectFilterChip
                    key={date}
                    label={dateLabel(date)}
                    icon={<CalendarOutline className="size-3" />}
                    onRemove={alwaysAllowEditing ? () => handleRemoveFilter("created_at", date) : undefined}
                  />
                ))}
              {filterKey === "created_by" && (
                <AppliedMembersFilters
                  values={Array.isArray(value) ? value : []}
                  editable={alwaysAllowEditing}
                  handleRemove={(id) => handleRemoveFilter("created_by", id)}
                />
              )}
              {filterKey === "labels" &&
                Array.isArray(value) &&
                value.map((id) => {
                  const label = labels.get(id);
                  return (
                    <ProjectFilterChip
                      key={id}
                      label={label?.name ?? t("web.configuration_deleted_filter")}
                      icon={
                        label?.color ? (
                          <span className="size-2 shrink-0 rounded-full" style={{ background: label.color }} />
                        ) : undefined
                      }
                      onRemove={alwaysAllowEditing ? () => handleRemoveFilter("labels", id) : undefined}
                    />
                  );
                })}
              {alwaysAllowEditing && (
                <IconButton
                  variant="ghost"
                  size="xs"
                  icon={<CloseOutline />}
                  aria-label={`${t("remove")} ${filterLabels[filterKey]}`}
                  onClick={() => handleRemoveFilter(filterKey, null)}
                />
              )}
            </div>
          </div>
        );
      })}
      {alwaysAllowEditing && (
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          label={t("common.clear_all")}
          onClick={handleClearAllFilters}
        />
      )}
    </div>
  );
});
