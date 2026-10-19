/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState, type ReactNode } from "react";
import { observer } from "mobx-react";
import { FilterOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { IIssueFilterOptions, IState } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { FilterSearchInput } from "@/components/common/filters/filter-search-input";
import {
  FilterAssignees,
  FilterDueDate,
  FilterPriority,
  FilterProjects,
  FiltersDropdown,
  FilterStartDate,
  FilterState,
  FilterStateGroup,
} from "@/components/issues/issue-layouts/filters";
import { isFiltersApplied } from "@/components/issues/issue-layouts/utils";
type TSubIssueFiltersProps = {
  handleFiltersUpdate: (key: keyof IIssueFilterOptions, value: string | string[]) => void;
  filters: IIssueFilterOptions;
  memberIds: string[] | undefined;
  states?: IState[];
  availableFilters: (keyof IIssueFilterOptions)[];
};

/** Renders a single filter section only when the filter is available for the current layout. */
function SubIssueFilterItem({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return null;
  return <div className="py-2">{children}</div>;
}

export const SubIssueFilters = observer(function SubIssueFilters(props: TSubIssueFiltersProps) {
  const { handleFiltersUpdate, filters, memberIds, states, availableFilters } = props;
  // plane hooks
  const { t } = useTranslation();
  // states
  const [filtersSearchQuery, setFiltersSearchQuery] = useState("");

  const isFilterEnabled = (filter: keyof IIssueFilterOptions) => !!availableFilters.includes(filter);

  const isFilterApplied = useMemo(() => isFiltersApplied(filters), [filters]);

  return (
    <>
      <FiltersDropdown
        placement="bottom-end"
        menuButton={
          <div
            className={cn(
              "relative rounded-sm p-1 transition-all duration-200",
              isFilterApplied && "bg-accent-primary/20"
            )}
          >
            {isFilterApplied && <span className="absolute -top-1 -right-1 rounded-full bg-accent-primary p-1" />}
            <FilterOutline className="h-3.5 w-3.5 text-primary" />
          </div>
        }
      >
        <div className="flex max-h-[350px] flex-col overflow-hidden">
          <div className="bg-surface-1 p-2.5 pb-0">
            <FilterSearchInput
              value={filtersSearchQuery}
              onChange={setFiltersSearchQuery}
              placeholder={t("common.search.label")}
            />
          </div>
          <div className="vertical-scrollbar scrollbar-sm h-full w-full divide-y divide-subtle-1 overflow-y-auto px-2.5 text-left">
            {/* Priority */}
            <SubIssueFilterItem enabled={isFilterEnabled("priority")}>
              <FilterPriority
                appliedFilters={filters.priority ?? null}
                handleUpdate={(val) => handleFiltersUpdate("priority", val)}
                searchQuery={filtersSearchQuery}
              />
            </SubIssueFilterItem>

            {/* state group */}
            <SubIssueFilterItem enabled={isFilterEnabled("state_group")}>
              <FilterStateGroup
                appliedFilters={filters.state_group ?? null}
                handleUpdate={(val) => handleFiltersUpdate("state_group", val)}
                searchQuery={filtersSearchQuery}
              />
            </SubIssueFilterItem>

            {/* State */}
            <SubIssueFilterItem enabled={isFilterEnabled("state")}>
              <FilterState
                appliedFilters={filters.state ?? null}
                handleUpdate={(val) => handleFiltersUpdate("state", val)}
                searchQuery={filtersSearchQuery}
                states={states}
              />
            </SubIssueFilterItem>

            {/* Projects */}
            <SubIssueFilterItem enabled={isFilterEnabled("project")}>
              <FilterProjects
                appliedFilters={filters.project ?? null}
                handleUpdate={(val) => handleFiltersUpdate("project", val)}
                searchQuery={filtersSearchQuery}
              />
            </SubIssueFilterItem>

            {/* Assignees */}
            <SubIssueFilterItem enabled={isFilterEnabled("assignees")}>
              <FilterAssignees
                appliedFilters={filters.assignees ?? null}
                handleUpdate={(val) => handleFiltersUpdate("assignees", val)}
                memberIds={memberIds}
                searchQuery={filtersSearchQuery}
              />
            </SubIssueFilterItem>

            {/* Start Date */}
            <SubIssueFilterItem enabled={isFilterEnabled("start_date")}>
              <FilterStartDate
                appliedFilters={filters.start_date ?? null}
                handleUpdate={(val) => handleFiltersUpdate("start_date", val)}
                searchQuery={filtersSearchQuery}
              />
            </SubIssueFilterItem>

            {/* Target Date */}
            <SubIssueFilterItem enabled={isFilterEnabled("target_date")}>
              <FilterDueDate
                appliedFilters={filters.target_date ?? null}
                handleUpdate={(val) => handleFiltersUpdate("target_date", val)}
                searchQuery={filtersSearchQuery}
              />
            </SubIssueFilterItem>
          </div>
        </div>
      </FiltersDropdown>
    </>
  );
});
