/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// ui
import { observer } from "mobx-react";
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import {
  ChevronDownOutline,
  EraserOutline,
  SortAscendingOutline,
  SortDescendingOutline,
} from "@makeplane/propel/icons";
// constants
import type { IProjectMemberDisplayProperties, TMemberOrderByOptions } from "@plane/constants";
import { MEMBER_PROPERTY_DETAILS } from "@plane/constants";
// i18n
import { useTranslation } from "@plane/i18n";
// types
import type { IMemberFilters } from "@/store/member/utils";

interface Props {
  property: keyof IProjectMemberDisplayProperties;
  displayFilters?: IMemberFilters;
  handleDisplayFilterUpdate: (data: Partial<IMemberFilters>) => void;
}

export const MemberHeaderColumn = observer(function MemberHeaderColumn(props: Props) {
  const { displayFilters, handleDisplayFilterUpdate, property } = props;
  // i18n
  const { t } = useTranslation();
  // Sort bounds come from constants as English words ("Old", "Low", "A", ...)
  const sortOrderLabel = (title: string) => {
    const key = `common.sort_order.${title.toLowerCase()}`;
    const label = t(key);
    return label === key ? title : label;
  };

  const propertyDetails = MEMBER_PROPERTY_DETAILS[property];

  const activeSortingProperty = displayFilters?.order_by;

  const handleOrderBy = (order: TMemberOrderByOptions, _itemKey: keyof IProjectMemberDisplayProperties) => {
    handleDisplayFilterUpdate({ order_by: order });
  };

  const handleClearSorting = () => {
    handleDisplayFilterUpdate({ order_by: undefined });
  };

  if (!propertyDetails) return null;

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={t(propertyDetails.i18n_title)}
            className="clickable flex h-5 w-fit cursor-pointer items-center justify-between gap-1.5 py-0 text-13 text-secondary hover:text-primary"
          />
        }
      >
        <span>{t(propertyDetails.i18n_title)}</span>
        <div className="ml-3 flex">
          {(activeSortingProperty === propertyDetails.ascendingOrderKey ||
            activeSortingProperty === propertyDetails.descendingOrderKey) && (
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full">
              {propertyDetails.ascendingOrderKey === activeSortingProperty ? (
                <SortDescendingOutline className="h-3 w-3" />
              ) : (
                <SortAscendingOutline className="h-3 w-3" />
              )}
            </div>
          )}
          <ChevronDownOutline className="h-3 w-3" aria-hidden="true" />
        </div>
      </MenuTrigger>
      <MenuContent side="bottom" align="start" sizing="anchor">
        {propertyDetails.isSortingAllowed && (
          <>
            <MenuItem
              icon={<Icon icon={SortDescendingOutline} />}
              label={`${sortOrderLabel(propertyDetails.ascendingOrderTitle)} → ${sortOrderLabel(propertyDetails.descendingOrderTitle)}`}
              selected={activeSortingProperty === propertyDetails.ascendingOrderKey}
              onClick={() => handleOrderBy(propertyDetails.ascendingOrderKey, property)}
            />
            <MenuItem
              icon={<Icon icon={SortAscendingOutline} />}
              label={`${sortOrderLabel(propertyDetails.descendingOrderTitle)} → ${sortOrderLabel(propertyDetails.ascendingOrderTitle)}`}
              selected={activeSortingProperty === propertyDetails.descendingOrderKey}
              onClick={() => handleOrderBy(propertyDetails.descendingOrderKey, property)}
            />
            {(activeSortingProperty === propertyDetails.ascendingOrderKey ||
              activeSortingProperty === propertyDetails.descendingOrderKey) && (
              <MenuItem
                key={property}
                icon={<Icon icon={EraserOutline} />}
                label={t("common.actions.clear_sorting")}
                onClick={handleClearSorting}
              />
            )}
          </>
        )}
      </MenuContent>
    </Menu>
  );
});
