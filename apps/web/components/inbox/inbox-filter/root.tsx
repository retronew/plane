import { observer } from "mobx-react";
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import { useTranslation } from "@plane/i18n";
import { FilterToggleButton } from "@/components/common/filter-toggle-button";
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { InboxIssueFilterSelection } from "./filters/filter-selection";
import { InboxIssueOrderByDropdown } from "./sorting/order-by";

export const FiltersRoot = observer(function FiltersRoot() {
  const { t } = useTranslation();
  const { getAppliedFiltersCount } = useProjectInbox();
  const active = getAppliedFiltersCount > 0;
  return (
    <div className="relative flex items-center gap-2">
      <Menu>
        <MenuTrigger
          render={
            <FilterToggleButton
              active={active}
              size="md"
              showTooltip
              aria-pressed={active}
              aria-label={t("common.filters")}
            />
          }
        />
        <MenuContent side="bottom" align="end">
          <InboxIssueFilterSelection />
        </MenuContent>
      </Menu>
      <InboxIssueOrderByDropdown />
    </div>
  );
});
