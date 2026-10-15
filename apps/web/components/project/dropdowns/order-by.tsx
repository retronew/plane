import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import { SortMenuItems } from "@/components/common/sort-menu";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
import { SortDescendingOutline } from "@makeplane/propel/icons";
// plane imports
import { PROJECT_ORDER_BY_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TProjectOrderByOptions } from "@plane/types";

type Props = {
  onChange: (value: TProjectOrderByOptions) => void;
  value: TProjectOrderByOptions | undefined;
  isMobile?: boolean;
};

export function ProjectOrderByDropdown(props: Props) {
  const { onChange, value, isMobile = false } = props;
  const { t } = useTranslation();

  const orderByDetails = PROJECT_ORDER_BY_OPTIONS.find((option) => value?.includes(option.key));

  const activeValue = value ?? "created_at";
  const field = activeValue.replace(/^-/, "");
  const isDescending = activeValue.startsWith("-");

  return (
    <Menu>
      <div className={isMobile ? "flex w-full justify-center" : undefined}>
        {/* `getButtonStyling` has no Propel counterpart: the trigger borrows the styled button element
            and Base UI grafts the menu behaviour onto it. */}
        <MenuTrigger
          nativeButton={false}
          render={<ButtonElement variant="secondary" size="md" stretch="auto" render={<span />} />}
        >
          <SortDescendingOutline className="size-3.5 shrink-0" />
          {orderByDetails && t(orderByDetails?.i18n_label)}
        </MenuTrigger>
      </div>
      <MenuContent side="bottom" align="end">
        <SortMenuItems
          field={field}
          direction={isDescending ? "desc" : "asc"}
          options={PROJECT_ORDER_BY_OPTIONS.map((option) => ({ value: option.key, label: t(option.i18n_label) }))}
          directionDisabled={field === "sort_order"}
          onFieldChange={(next) =>
            onChange((next === "sort_order" ? next : `${isDescending ? "-" : ""}${next}`) as TProjectOrderByOptions)
          }
          onDirectionChange={(next) => onChange(`${next === "desc" ? "-" : ""}${field}` as TProjectOrderByOptions)}
        />
      </MenuContent>
    </Menu>
  );
}
