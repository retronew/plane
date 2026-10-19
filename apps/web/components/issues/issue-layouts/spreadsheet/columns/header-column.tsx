/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

//ui
import { Icon } from "@makeplane/propel/components/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import {
  ChevronDownOutline,
  EraserOutline,
  SortAscendingOutline,
  SortDescendingOutline,
} from "@makeplane/propel/icons";
// constants
import { SPREADSHEET_PROPERTY_DETAILS } from "@plane/constants";
// i18n
import { useTranslation } from "@plane/i18n";
// types
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, TIssueOrderByOptions } from "@plane/types";
import { Row } from "@plane/blocks/layout";
import { SpreadsheetPropertyIcon } from "../property-icon";

interface Props {
  property: keyof IIssueDisplayProperties;
  displayFilters: IIssueDisplayFilterOptions;
  handleDisplayFilterUpdate: (data: Partial<IIssueDisplayFilterOptions>) => void;
  onClose: () => void;
}

export function HeaderColumn(props: Props) {
  const { displayFilters, handleDisplayFilterUpdate, property, onClose } = props;
  // i18n
  const { t } = useTranslation();
  // Sort bounds come from constants as English words ("Old", "Low", "A", ...)
  const sortOrderLabel = (title: string) => {
    const key = `common.sort_order.${title.toLowerCase()}`;
    const label = t(key);
    return label === key ? title : label;
  };
  const propertyDetails = SPREADSHEET_PROPERTY_DETAILS[property];

  const handleOrderBy = (order: TIssueOrderByOptions) => handleDisplayFilterUpdate({ order_by: order });

  if (!propertyDetails) return null;

  const ascending = displayFilters.order_by === propertyDetails.ascendingOrderKey;
  const descending = displayFilters.order_by === propertyDetails.descendingOrderKey;
  const isSorted = ascending || descending;

  return (
    <Menu
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <MenuTrigger
        render={
          <button type="button" tabIndex={-1} aria-label={t(propertyDetails.i18n_title)} className="clickable w-full">
            <Row className="flex w-full cursor-pointer items-center justify-between gap-1.5 py-2 text-13 text-secondary hover:text-primary">
              <div className="flex items-center gap-1.5">
                {<SpreadsheetPropertyIcon iconKey={propertyDetails.icon} className="h-4 w-4 text-placeholder" />}
                {t(propertyDetails.i18n_title)}
              </div>
              <div className="ml-3 flex">
                {isSorted && (
                  <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full">
                    {displayFilters.order_by?.startsWith("-") ? (
                      <SortDescendingOutline className="h-3 w-3" />
                    ) : (
                      <SortAscendingOutline className="h-3 w-3" />
                    )}
                  </div>
                )}
                <ChevronDownOutline className="h-3 w-3" aria-hidden="true" />
              </div>
            </Row>
          </button>
        }
      />
      <MenuContent side="bottom" align="start">
        <MenuItem
          icon={
            <Icon
              icon={propertyDetails.ascendingOrderKey.startsWith("-") ? SortDescendingOutline : SortAscendingOutline}
            />
          }
          label={`${sortOrderLabel(propertyDetails.ascendingOrderTitle)} → ${sortOrderLabel(propertyDetails.descendingOrderTitle)}`}
          selected={ascending}
          onClick={() => handleOrderBy(propertyDetails.ascendingOrderKey)}
        />
        <MenuItem
          icon={
            <Icon
              icon={propertyDetails.descendingOrderKey.startsWith("-") ? SortDescendingOutline : SortAscendingOutline}
            />
          }
          label={`${sortOrderLabel(propertyDetails.descendingOrderTitle)} → ${sortOrderLabel(propertyDetails.ascendingOrderTitle)}`}
          selected={descending}
          onClick={() => handleOrderBy(propertyDetails.descendingOrderKey)}
        />
        {isSorted && displayFilters.order_by !== "-created_at" && (
          <MenuItem
            key={property}
            icon={<Icon icon={EraserOutline} />}
            label={t("common.actions.clear_sorting")}
            onClick={() => handleOrderBy("-created_at")}
          />
        )}
      </MenuContent>
    </Menu>
  );
}
