/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
// plane constants
import { DATE_AFTER_FILTER_OPTIONS } from "@plane/constants";
// components
import { isInDateFormat } from "@plane/utils";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";
import { translate } from "@plane/i18n";
// helpers

type Props = {
  appliedFilters: string[] | null;
  handleUpdate: (val: string | string[]) => void;
  searchQuery: string;
};

export const FilterTargetDate = observer(function FilterTargetDate(props: Props) {
  const { appliedFilters, handleUpdate, searchQuery } = props;

  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);

  const appliedFiltersCount = appliedFilters?.length ?? 0;
  const appliedFilterSet = new Set(appliedFilters ?? []);

  const filteredOptions = DATE_AFTER_FILTER_OPTIONS.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCustomDateSelected = () => {
    const isValidDateSelected = appliedFilters?.filter((f) => isInDateFormat(f.split(";")[0])) || [];
    return isValidDateSelected.length > 0;
  };
  const handleCustomDate = () => {
    if (isCustomDateSelected()) {
      const updateAppliedFilters = appliedFilters?.filter((f) => f.includes("-")) || [];
      handleUpdate(updateAppliedFilters);
    } else setIsDateFilterModalOpen(true);
  };

  return (
    <>
      {isDateFilterModalOpen && (
        <DateFilterModal
          handleClose={() => setIsDateFilterModalOpen(false)}
          isOpen={isDateFilterModalOpen}
          onSelect={(val) => handleUpdate(val)}
          title={translate("web.due_date")}
        />
      )}
      <FilterHeader
        field="target_date"
        title={translate("web.runtime.filter_due_date", { count: appliedFiltersCount })}
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
                  isChecked={appliedFilterSet.has(option.value)}
                  onClick={() => handleUpdate(option.value)}
                  title={option.name}
                  multiple
                />
              ))}
              <FilterOption
                isChecked={isCustomDateSelected()}
                onClick={handleCustomDate}
                title={translate("web.custom")}
                multiple
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
