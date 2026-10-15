/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import {
  MenuRadioGroup,
  MenuRadioItem,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
} from "@makeplane/propel/components/menu";
import { useTranslation } from "@plane/i18n";

export type SortDirection = "asc" | "desc";
/** The same two sibling controls for display menus and standalone sorting menus. */
export function SortMenuItems<T extends string>({
  field,
  direction,
  options,
  onFieldChange,
  onDirectionChange,
  directionDisabled = false,
}: {
  field: T;
  direction: SortDirection;
  options: { value: T; label: string }[];
  onFieldChange: (field: T) => void;
  onDirectionChange: (direction: SortDirection) => void;
  directionDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <MenuSubmenu>
        <MenuSubmenuTrigger
          label={t("common.sort.field")}
          trailing={
            <span className="max-w-32 truncate text-secondary">
              {options.find((option) => option.value === field)?.label}
            </span>
          }
        />
        <MenuSubmenuContent>
          <div className="min-w-36">
            <MenuRadioGroup
              value={field}
              onValueChange={(value) => {
                const selectedOption = options.find((option) => option.value === value);
                if (selectedOption) onFieldChange(selectedOption.value);
              }}
            >
              {options.map((option) => (
                <MenuRadioItem key={option.value} value={option.value} label={option.label} closeOnClick={false} />
              ))}
            </MenuRadioGroup>
          </div>
        </MenuSubmenuContent>
      </MenuSubmenu>
      <MenuSubmenu>
        <MenuSubmenuTrigger
          label={t("common.sort.direction")}
          disabled={directionDisabled}
          trailing={
            <span className="text-secondary">
              {directionDisabled ? "--" : t(direction === "desc" ? "common.sort.desc" : "common.sort.asc")}
            </span>
          }
        />
        <MenuSubmenuContent>
          <div className="min-w-24">
            <MenuRadioGroup
              value={direction}
              onValueChange={(value) => {
                if (!directionDisabled && (value === "asc" || value === "desc")) onDirectionChange(value);
              }}
            >
              <MenuRadioItem value="asc" label={t("common.sort.asc")} closeOnClick={false} />
              <MenuRadioItem value="desc" label={t("common.sort.desc")} closeOnClick={false} />
            </MenuRadioGroup>
          </div>
        </MenuSubmenuContent>
      </MenuSubmenu>
    </>
  );
}
