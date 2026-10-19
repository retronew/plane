/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import { PreferencesOutline } from "@makeplane/propel/icons";
// plane imports
import type { IIssueDisplayFilterOptions, ILayoutDisplayFiltersOptions, IIssueDisplayProperties } from "@plane/types";
import { cn } from "@plane/utils";
import { useTranslation } from "@plane/i18n";
// components
import { DisplayFiltersSelection, FiltersDropdown } from "@/components/issues/issue-layouts/filters";
import { isDisplayFiltersApplied } from "@/components/issues/issue-layouts/utils";
type TSubIssueDisplayFiltersProps = {
  displayProperties: IIssueDisplayProperties;
  displayFilters: IIssueDisplayFilterOptions;
  handleDisplayFiltersUpdate: (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => void;
  handleDisplayPropertiesUpdate: (updatedDisplayProperties: Partial<IIssueDisplayProperties>) => void;
  layoutDisplayFiltersOptions: ILayoutDisplayFiltersOptions | undefined;
};

export const SubIssueDisplayFilters = observer(function SubIssueDisplayFilters(props: TSubIssueDisplayFiltersProps) {
  const {
    displayProperties,
    layoutDisplayFiltersOptions,
    handleDisplayPropertiesUpdate,
    handleDisplayFiltersUpdate,
    displayFilters,
  } = props;

  const { t } = useTranslation();
  const isFilterApplied = useMemo(
    () => isDisplayFiltersApplied({ displayProperties, displayFilters }),
    [displayProperties, displayFilters]
  );

  return (
    <>
      {layoutDisplayFiltersOptions?.display_filters && layoutDisplayFiltersOptions?.display_properties.length > 0 && (
        <FiltersDropdown
          displayMenu
          title={t("common.display")}
          placement="bottom-end"
          menuButton={
            <div
              className={cn(
                "relative rounded-sm p-1 transition-all duration-200",
                isFilterApplied && "bg-accent-primary/20"
              )}
            >
              {isFilterApplied && <span className="absolute -top-1 -right-1 rounded-full bg-accent-primary p-1" />}
              <PreferencesOutline className="h-3.5 w-3.5 text-primary" />
            </div>
          }
        >
          <DisplayFiltersSelection
            displayProperties={displayProperties}
            displayFilters={displayFilters}
            handleDisplayPropertiesUpdate={handleDisplayPropertiesUpdate}
            handleDisplayFiltersUpdate={handleDisplayFiltersUpdate}
            layoutDisplayFiltersOptions={layoutDisplayFiltersOptions}
          />
        </FiltersDropdown>
      )}
    </>
  );
});
