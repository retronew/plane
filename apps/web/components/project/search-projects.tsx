import { observer } from "mobx-react";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
import { useTranslation } from "@plane/i18n";
import { useProjectFilter } from "@/hooks/store/use-project-filter";

export const ProjectSearch = observer(function ProjectSearch() {
  const { t } = useTranslation();
  const { searchQuery, updateSearchQuery } = useProjectFilter();
  return (
    <ExpandableSearch
      size="md"
      aria-label={t("web.project_page.search")}
      placeholder={t("web.project_page.search")}
      clearLabel={t("common.clear")}
      value={searchQuery}
      onValueChange={(value) => updateSearchQuery(value ?? "")}
    />
  );
});
