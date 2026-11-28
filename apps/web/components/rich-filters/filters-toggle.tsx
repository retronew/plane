/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { FilterToggleButton } from "@/components/common/filter-toggle-button";
import { useTranslation } from "@plane/i18n";
import type { IFilterInstance } from "@plane/shared-state";
import type { SingleOrArray, TExternalFilter, TFilterProperty, TFilterValue, TSupportedOperators } from "@plane/types";
import { LOGICAL_OPERATOR } from "@plane/types";
// components
import { AddFilterDropdown } from "@/components/rich-filters/add-filters/dropdown";

type TFiltersToggleProps<P extends TFilterProperty, E extends TExternalFilter> = {
  filter: IFilterInstance<P, E> | undefined;
};

export const FiltersToggle = observer(function FiltersToggle<P extends TFilterProperty, E extends TExternalFilter>(
  props: TFiltersToggleProps<P, E>
) {
  const { filter } = props;
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const activeConditionCount = filter?.allConditionsForDisplay.length ?? 0;
  const hasAnyConditions = activeConditionCount > 0;
  const hasUpdates = filter?.canUpdateView === true && filter?.hasChanges === true;
  const isActive = hasUpdates || hasAnyConditions;

  if (!filter) {
    return (
      <Tooltip label={t("common.filters")} side="bottom">
        <span className="inline-flex">
          <FilterToggleButton size="md" active={false} disabled aria-label={t("common.filters")} />
        </span>
      </Tooltip>
    );
  }

  const handleFilterSelect = (
    property: P,
    operator: TSupportedOperators,
    isNegation: boolean,
    value?: SingleOrArray<TFilterValue>
  ) => {
    filter.addCondition(
      LOGICAL_OPERATOR.AND,
      {
        property,
        operator,
        value,
      },
      isNegation
    );
    filter.toggleVisibility(true);
  };

  return (
    <Tooltip label={t("common.filters")} side="bottom">
      <span className="inline-flex">
        <AddFilterDropdown
          filter={filter}
          align="end"
          keepOpenOnMultiSelect
          syncWithApplied
          triggerAriaLabel={t("common.filters")}
          handleFilterSelect={handleFilterSelect}
          customButton={<FilterToggleButton size="md" active={isActive} count={activeConditionCount} renderAsSpan />}
        />
      </span>
    </Tooltip>
  );
});
