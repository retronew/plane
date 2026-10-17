import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import type { CycleTab } from "./tab-navigation";

export function CycleTabEmptyState({
  tab,
  hasSearch = false,
  hasFilters = false,
}: {
  tab: CycleTab;
  hasSearch?: boolean;
  hasFilters?: boolean;
}) {
  const { t } = useTranslation();
  const filtered = hasSearch || hasFilters;
  const description = hasSearch
    ? "project_cycles.remove_search_criteria_to_see_all_cycles"
    : "project_cycles.remove_filters_to_see_all_cycles";
  return (
    <EmptyStateDetailed
      assetKey={tab === "completed" ? "archived-cycle" : "cycle"}
      assetClassName="h-auto w-40"
      title={t(filtered ? "project_cycles.no_matching_cycles" : `project_cycles.empty_state.${tab}.title`)}
      description={t(filtered ? description : `project_cycles.empty_state.${tab}.description`)}
    />
  );
}
