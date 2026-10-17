/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ExpandableSearch } from "@makeplane/propel/components/expandable-search";
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import { useTranslation } from "@plane/i18n";
import type { TCycleFilters } from "@plane/types";
import { calculateTotalFilters } from "@plane/utils";
import { FilterToggleButton } from "@/components/common/filter-toggle-button";
import { useCycleFilter } from "@/hooks/store/use-cycle-filter";
import { CycleFiltersSelection } from "./dropdowns";

type Props = { projectId: string };

export const CyclesViewHeader = observer(function CyclesViewHeader({ projectId }: Props) {
  const { currentProjectFilters, searchQuery, updateFilters, updateSearchQuery } = useCycleFilter();
  const { t } = useTranslation();
  const isFiltersApplied = calculateTotalFilters(currentProjectFilters ?? {}) !== 0;
  const handleFilters = (key: keyof TCycleFilters, value: string | string[]) => {
    const next = new Set(currentProjectFilters?.[key] ?? []);
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (next.has(entry)) next.delete(entry);
      else next.add(entry);
    }
    updateFilters(projectId, { [key]: [...next] });
  };

  return (
    <div className="flex items-center gap-2">
      <ExpandableSearch
        size="md"
        aria-label={t("common.search.label")}
        placeholder={t("common.search.label")}
        clearLabel={t("common.clear")}
        value={searchQuery}
        onValueChange={(value) => updateSearchQuery(value ?? "")}
      />
      <Menu>
        <MenuTrigger
          render={
            <FilterToggleButton
              active={isFiltersApplied}
              size="md"
              showTooltip
              aria-pressed={isFiltersApplied}
              aria-label={t("common.filters")}
            />
          }
        />
        <MenuContent side="bottom" align="end">
          <CycleFiltersSelection filters={currentProjectFilters ?? {}} handleFiltersUpdate={handleFilters} />
        </MenuContent>
      </Menu>
    </div>
  );
});
