/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { concat, uniq } from "lodash-es";
import { observer } from "mobx-react";
import { PAST_DURATION_FILTER_OPTIONS } from "@plane/constants";
import type { TInboxIssueFilterDateKeys } from "@plane/types";
// components
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";
// constants
// hooks
import { useProjectInbox } from "@/hooks/store/use-project-inbox";
import { translate } from "@plane/i18n";

type Props = {
  filterKey: TInboxIssueFilterDateKeys;
  label?: string;
  searchQuery: string;
};

const isDate = (date: string) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(date);
};

export const FilterDate = observer(function FilterDate(props: Props) {
  const { filterKey, label, searchQuery } = props;
  // hooks
  const { inboxFilters, handleInboxIssueFilters } = useProjectInbox();
  // state
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
  // derived values
  const rawFilterValue = inboxFilters?.[filterKey];
  const filterValue: string[] = rawFilterValue || [];
  const filterValueSet = useMemo(() => new Set(rawFilterValue ?? []), [rawFilterValue]);
  const appliedFiltersCount = filterValue?.length ?? 0;
  const filteredOptions = PAST_DURATION_FILTER_OPTIONS.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFilterValue = (value: string): string[] => (filterValue?.includes(value) ? [] : uniq(concat(value)));

  const isCustomDateSelected = () => {
    const isValidDateSelected = filterValue?.filter((f) => isDate(f.split(";")[0])) || [];
    return isValidDateSelected.length > 0;
  };

  const handleCustomDate = () => {
    if (isCustomDateSelected()) {
      const updateAppliedFilters = filterValue?.filter((f) => !isDate(f.split(";")[0])) || [];
      handleInboxIssueFilters(filterKey, updateAppliedFilters);
    } else {
      setIsDateFilterModalOpen(true);
    }
  };

  return (
    <>
      {isDateFilterModalOpen && (
        <DateFilterModal
          handleClose={() => setIsDateFilterModalOpen(false)}
          isOpen={isDateFilterModalOpen}
          onSelect={(val) => handleInboxIssueFilters(filterKey, val)}
          title={translate("web.created_date")}
        />
      )}
      <FilterHeader
        field="date"
        title={`${label || "Created date"}${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
        isPreviewEnabled={previewEnabled}
        handleIsPreviewEnabled={() => setPreviewEnabled(!previewEnabled)}
      />
      {previewEnabled && (
        <div>
          {filteredOptions.length > 0 ? (
            <>
              {filteredOptions.map((option) => (
                <FilterOption
                  key={option.value}
                  isChecked={filterValueSet.has(option.value)}
                  onClick={() => handleInboxIssueFilters(filterKey, handleFilterValue(option.value))}
                  title={option.name}
                  multiple={false}
                />
              ))}
              <FilterOption
                isChecked={isCustomDateSelected()}
                onClick={handleCustomDate}
                title={translate("web.custom")}
                multiple={false}
              />
            </>
          ) : (
            <p className="text-11 text-placeholder italic">{translate("web.no_matches_found")}</p>
          )}
        </div>
      )}
    </>
  );
});
