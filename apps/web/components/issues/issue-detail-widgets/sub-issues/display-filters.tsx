/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Menu, MenuTrigger } from "@makeplane/propel/components/menu";
import { PreferencesOutline } from "@makeplane/propel/icons";
import { ActionMenuContent } from "@plane/blocks/common";
import type { IIssueDisplayFilterOptions, ILayoutDisplayFiltersOptions, IIssueDisplayProperties } from "@plane/types";
import { cn } from "@plane/utils";
import { useTranslation } from "@plane/i18n";
import { DisplayFiltersSelection } from "@/components/issues/issue-layouts/filters";
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

  if (!layoutDisplayFiltersOptions?.display_filters || !layoutDisplayFiltersOptions.display_properties.length)
    return null;

  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t("common.display")}
            icon={<Icon icon={PreferencesOutline} />}
            render={(renderProps) => (
              <button
                {...renderProps}
                className={cn(renderProps.className, isFilterApplied && "bg-accent-primary/20 text-accent-primary")}
              />
            )}
          />
        }
      />
      <ActionMenuContent side="bottom" align="end">
        <DisplayFiltersSelection
          displayProperties={displayProperties}
          displayFilters={displayFilters}
          handleDisplayPropertiesUpdate={handleDisplayPropertiesUpdate}
          handleDisplayFiltersUpdate={handleDisplayFiltersUpdate}
          layoutDisplayFiltersOptions={layoutDisplayFiltersOptions}
        />
      </ActionMenuContent>
    </Menu>
  );
});
