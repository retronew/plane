import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { FilterPriority } from "@/components/issues/issue-layouts/filters/header/filters/priority";
import { FilterStateGroup } from "@/components/issues/issue-layouts/filters/header/filters/state-group";

export type ExistingIssueFilters = { state_group: string[]; priority: string[] };
export const emptyExistingIssueFilters = (): ExistingIssueFilters => ({ state_group: [], priority: [] });

export function ExistingIssuesFilters({
  value,
  onChange,
}: {
  value: ExistingIssueFilters;
  onChange: (value: ExistingIssueFilters) => void;
}) {
  const { t } = useTranslation();
  const count = value.state_group.length + value.priority.length;
  const toggle = (field: keyof ExistingIssueFilters, option: string) => {
    const current = value[field];
    onChange({
      ...value,
      [field]: current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    });
  };
  return (
    <div className="flex items-center justify-end gap-2 px-4 pt-3">
      <Popover>
        <PopoverTrigger
          render={
            <Button size="sm" variant={count ? "tertiary" : "secondary"} stretch="auto" label={t("common.filters")} />
          }
        />
        <PopoverContent side="bottom" align="end">
          <div className="max-h-80 w-64 overflow-y-auto p-2">
            <FilterStateGroup
              appliedFilters={value.state_group}
              handleUpdate={(option) => toggle("state_group", option)}
              searchQuery=""
            />
            <FilterPriority
              appliedFilters={value.priority}
              handleUpdate={(option) => toggle("priority", option)}
              searchQuery=""
            />
          </div>
        </PopoverContent>
      </Popover>
      {count > 0 && (
        <Button
          size="sm"
          variant="ghost"
          stretch="auto"
          label={t("common.clear_all")}
          onClick={() => onChange(emptyExistingIssueFilters())}
        />
      )}
    </div>
  );
}
