import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { MODULE_ORDER_BY_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { SortMenuItems } from "@/components/common/sort-menu";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import { ChevronDownOutline, SortDescendingOutline, SortAscendingOutline } from "@makeplane/propel/icons";
import type { TModuleOrderByOptions } from "@plane/types";

type Props = {
  onChange: (value: TModuleOrderByOptions) => void;
  value: TModuleOrderByOptions | undefined;
};

export function ModuleOrderByDropdown(props: Props) {
  const { onChange, value } = props;
  // hooks
  const { t } = useTranslation();

  const orderByDetails = MODULE_ORDER_BY_OPTIONS.find((option) => value?.includes(option.key));

  const activeValue = value ?? "created_at";
  const field = activeValue.replace(/^-/, "");
  const isDescending = activeValue.startsWith("-");

  return (
    <Menu>
      {/* propel: `getButtonStyling` has no counterpart, so the trigger borrows the styled button
          element and Base UI grafts the menu behavior onto it. */}
      <MenuTrigger render={<ButtonElement variant="secondary" size="md" stretch="auto" />}>
        {!isDescending ? <SortAscendingOutline className="size-3" /> : <SortDescendingOutline className="size-3" />}
        {orderByDetails && t(orderByDetails?.i18n_label)}
        <ChevronDownOutline className="size-3" />
      </MenuTrigger>
      <MenuContent side="bottom" align="end">
        <SortMenuItems
          field={field}
          direction={isDescending ? "desc" : "asc"}
          options={MODULE_ORDER_BY_OPTIONS.map((option) => ({ value: option.key, label: t(option.i18n_label) }))}
          directionDisabled={field === "sort_order"}
          onFieldChange={(next) =>
            onChange((next === "sort_order" ? next : `${isDescending ? "-" : ""}${next}`) as TModuleOrderByOptions)
          }
          onDirectionChange={(next) => onChange(`${next === "desc" ? "-" : ""}${field}` as TModuleOrderByOptions)}
        />
      </MenuContent>
    </Menu>
  );
}
