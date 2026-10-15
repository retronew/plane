import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { useTranslation, translate } from "@plane/i18n";
import { SortMenuItems } from "@/components/common/sort-menu";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
// types
import type { TPageFiltersSortBy, TPageFiltersSortKey } from "@plane/types";
import { SortDescendingOutline, SortAscendingOutline } from "@makeplane/propel/icons";

type Props = {
  onChange: (value: { key?: TPageFiltersSortKey; order?: TPageFiltersSortBy }) => void;
  sortBy: TPageFiltersSortBy;
  sortKey: TPageFiltersSortKey;
};

const PAGE_SORTING_KEY_OPTIONS: {
  key: TPageFiltersSortKey;
  label: string;
}[] = [
  {
    key: "name",
    get label() {
      return translate("web.name");
    },
  },
  {
    key: "created_at",
    get label() {
      return translate("web.date_created");
    },
  },
  {
    key: "updated_at",
    get label() {
      return translate("web.date_modified");
    },
  },
];

export function PageOrderByDropdown(props: Props) {
  const { onChange, sortBy, sortKey } = props;
  // plane hooks
  useTranslation();

  const orderByDetails = PAGE_SORTING_KEY_OPTIONS.find((option) => sortKey === option.key);
  const isDescending = sortBy === "desc";

  return (
    <Menu>
      {/* propel: `getButtonStyling` has no counterpart, so the trigger borrows the styled button
          element and Base UI grafts the menu behavior onto it. */}
      <MenuTrigger render={<ButtonElement variant="secondary" size="md" stretch="auto" />}>
        {!isDescending ? <SortAscendingOutline className="size-3" /> : <SortDescendingOutline className="size-3" />}
        {orderByDetails?.label}
      </MenuTrigger>
      <MenuContent side="bottom" align="end">
        <SortMenuItems
          field={sortKey}
          direction={sortBy}
          options={PAGE_SORTING_KEY_OPTIONS.map((option) => ({
            value: option.key as TPageFiltersSortKey,
            label: option.label,
          }))}
          onFieldChange={(key) => onChange({ key })}
          onDirectionChange={(order) => onChange({ order: order as TPageFiltersSortBy })}
        />
      </MenuContent>
    </Menu>
  );
}
