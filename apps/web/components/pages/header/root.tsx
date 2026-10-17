/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { observer } from "mobx-react";
import { Badge } from "@makeplane/propel/components/badge";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Menu, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TPageFilterProps, TPageNavigationTabs } from "@plane/types";
import { Header, EHeaderVariant } from "@plane/blocks/layout";
import { calculateTotalFilters } from "@plane/utils";
// components
import { FilterToggleButton } from "@/components/common/filter-toggle-button";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { usePageStore } from "@/hooks/store";
import type { EPageStoreType } from "@/hooks/store";
// local imports
import { PageAppliedFiltersList } from "../list/applied-filters";
import { PageFiltersSelection } from "../list/filters";
import { PageOrderByDropdown } from "../list/order-by";
import { PageSearchInput } from "../list/search-input";
import { PageTabNavigation } from "../list/tab-navigation";

type Props = {
  pageType: TPageNavigationTabs;
  projectId: string;
  storeType: EPageStoreType;
  workspaceSlug: string;
};

export const PagesListHeaderRoot = observer(function PagesListHeaderRoot(props: Props) {
  const { pageType, projectId, storeType, workspaceSlug } = props;
  const { t } = useTranslation();
  // store hooks
  const {
    filters,
    updateFilters,
    clearAllFilters,
    getCurrentProjectPageIdsByTab,
    getCurrentProjectFilteredPageIdsByTab,
  } = usePageStore(storeType);
  const totalPages = getCurrentProjectPageIdsByTab(pageType)?.length ?? 0;
  const filteredPages = getCurrentProjectFilteredPageIdsByTab(pageType)?.length ?? 0;
  const {
    workspace: { workspaceMemberIds },
  } = useMember();

  const handleRemoveFilter = useCallback(
    (key: keyof TPageFilterProps, value: string | null) => {
      let newValues = filters.filters?.[key];

      if (key === "favorites") newValues = !!value;
      if (Array.isArray(newValues)) {
        if (!value) newValues = [];
        else newValues = newValues.filter((val) => val !== value);
      }

      updateFilters("filters", { ...filters.filters, [key]: newValues });
    },
    [filters.filters, updateFilters]
  );

  const isFiltersApplied = calculateTotalFilters(filters?.filters ?? {}) !== 0;

  return (
    <>
      <Header variant={EHeaderVariant.SECONDARY} setHeight={false} className="h-12 shrink-0">
        <Header.LeftItem className="h-full">
          <PageTabNavigation workspaceSlug={workspaceSlug} projectId={projectId} pageType={pageType} />
        </Header.LeftItem>
        <Header.RightItem className="items-center">
          <PageSearchInput
            searchQuery={filters.searchQuery}
            updateSearchQuery={(val) => updateFilters("searchQuery", val)}
          />
          <PageOrderByDropdown
            sortBy={filters.sortBy}
            sortKey={filters.sortKey}
            onChange={(val) => {
              if (val.key) updateFilters("sortKey", val.key);
              if (val.order) updateFilters("sortBy", val.order);
            }}
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
              <PageFiltersSelection
                projectId={projectId}
                filters={filters}
                handleFiltersUpdate={updateFilters}
                memberIds={workspaceMemberIds ?? undefined}
              />
            </MenuContent>
          </Menu>
        </Header.RightItem>
      </Header>
      {calculateTotalFilters(filters?.filters ?? {}) !== 0 && (
        <Header variant={EHeaderVariant.TERNARY}>
          <Header.LeftItem>
            <PageAppliedFiltersList
              projectId={projectId}
              appliedFilters={filters.filters ?? {}}
              handleClearAllFilters={clearAllFilters}
              handleRemoveFilter={handleRemoveFilter}
              alwaysAllowEditing
            />
          </Header.LeftItem>
          <Header.RightItem>
            <Tooltip
              label={t("web.runtime.matching_pages", { matched: filteredPages, total: totalPages })}
              layout="stacked"
            >
              <Badge size="sm" variant="neutral" label={`${filteredPages}/${totalPages}`} />
            </Tooltip>
          </Header.RightItem>
        </Header>
      )}
    </>
  );
});
