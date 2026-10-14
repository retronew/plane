import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Menu, MenuItem, MenuTrigger } from "@makeplane/propel/components/menu";
import { ChevronDownOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { TRecentActivityFilterKeys } from "@plane/types";
import { cn } from "@plane/utils";

export type TFiltersDropdown = {
  className?: string;
  activeFilter: TRecentActivityFilterKeys;
  setActiveFilter: (filter: TRecentActivityFilterKeys) => void;
  filters: { name: TRecentActivityFilterKeys; icon?: React.ReactNode; i18n_key: string }[];
};

export const FiltersDropdown = observer(function FiltersDropdown(props: TFiltersDropdown) {
  const { className, activeFilter, setActiveFilter, filters } = props;
  const { t } = useTranslation();

  const title = activeFilter ? filters?.find((filter) => filter.name === activeFilter)?.i18n_key : "";
  return (
    <div className={cn("flex w-fit justify-center text-11 text-secondary", className)}>
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              className="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-md border border-subtle bg-layer-2 px-2 text-caption-md-regular text-secondary outline-none hover:border-strong hover:bg-layer-2-hover focus-visible:ring-2 focus-visible:ring-accent-strong data-popup-open:bg-layer-2-active"
            >
              <span className="min-w-0 truncate">{t(title || "")}</span>
              <ChevronDownOutline className="size-3.5" />
            </button>
          }
        />
        <MenuContent side="bottom" align="start">
          {filters?.map((filter) => (
            <MenuItem
              key={filter.name}
              label={t(filter.i18n_key)}
              onClick={() => {
                setActiveFilter(filter.name);
              }}
            />
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
});
