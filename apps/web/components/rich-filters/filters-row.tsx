/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useState } from "react";
import { observer } from "mobx-react";
import { AddFilterOutline, CloseOutline } from "@makeplane/propel/icons";
// plane imports
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { Button } from "@makeplane/propel/components/button";
import type { IFilterInstance } from "@plane/shared-state";
import type { TExternalFilter, TFilterProperty } from "@plane/types";
import { EHeaderVariant, Header } from "@plane/blocks/layout";
import { Loader } from "@plane/blocks/skeleton";
import { cn } from "@plane/utils";
// local imports
import type { TAddFilterButtonProps } from "./add-filters/button";
import { AddFilterButton } from "./add-filters/button";
import { FilterItem } from "./filter-item/root";
import { ElementTransition, RowTransition } from "./transition-components";
import { translate } from "@plane/i18n";

export type TFiltersRowProps<K extends TFilterProperty, E extends TExternalFilter> = {
  buttonConfig?: TAddFilterButtonProps<K, E>["buttonConfig"];
  disabledAllOperations?: boolean;
  filter: IFilterInstance<K, E>;
  variant?: "modal" | "header";
};

type TFiltersRowVariant = "modal" | "header";

const getAddFilterButtonConfig = <K extends TFilterProperty, E extends TExternalFilter>(
  variant: TFiltersRowVariant,
  hasAnyConditions: boolean,
  buttonConfig: TAddFilterButtonProps<K, E>["buttonConfig"],
  disabledAllOperations: boolean
): TAddFilterButtonProps<K, E>["buttonConfig"] => ({
  label: variant === "modal" && !hasAnyConditions ? translate("web.filters") : null,
  ...(variant === "modal" ? { className: "rounded-lg [--control-radius-md:0.5rem]" } : {}),
  size: "md",
  iconConfig: {
    shouldShowIcon: true,
    iconComponent: AddFilterOutline,
  },
  ...buttonConfig,
  isDisabled: disabledAllOperations,
});

type TFiltersRowLeftContentProps<K extends TFilterProperty, E extends TExternalFilter> = {
  buttonConfig?: TAddFilterButtonProps<K, E>["buttonConfig"];
  disabledAllOperations: boolean;
  filter: IFilterInstance<K, E>;
  hasAnyConditions: boolean;
  variant: TFiltersRowVariant;
};

const FiltersRowLeftContent = observer(function FiltersRowLeftContent<
  K extends TFilterProperty,
  E extends TExternalFilter,
>(props: TFiltersRowLeftContentProps<K, E>) {
  const { buttonConfig, disabledAllOperations, filter, hasAnyConditions, variant } = props;

  return (
    <>
      {filter.allConditionsForDisplay.map((condition) => (
        <FilterItem key={condition.id} filter={filter} condition={condition} isDisabled={disabledAllOperations} />
      ))}
      <AddFilterButton
        filter={filter}
        buttonConfig={getAddFilterButtonConfig<K, E>(variant, hasAnyConditions, buttonConfig, disabledAllOperations)}
      />
    </>
  );
});

type TFiltersRowActionsProps<K extends TFilterProperty, E extends TExternalFilter> = {
  disabledAllOperations: boolean;
  filter: IFilterInstance<K, E>;
  isUpdating: boolean;
  onUpdate: () => void;
  variant: TFiltersRowVariant;
};

const FiltersRowActions = observer(function FiltersRowActions<K extends TFilterProperty, E extends TExternalFilter>(
  props: TFiltersRowActionsProps<K, E>
) {
  const { disabledAllOperations, filter, isUpdating, onUpdate, variant } = props;
  const hasAvailableOperations =
    !disabledAllOperations && (filter.canClearFilters || filter.canSaveView || filter.canUpdateView);

  return (
    <div
      data-filter-actions
      className={cn("flex shrink-0 items-center gap-2 border-l border-subtle pl-4", {
        "border-l-transparent pl-0": !hasAvailableOperations,
      })}
    >
      {!disabledAllOperations && (
        <>
          <ElementTransition show={filter.canClearFilters}>
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              label={filter.clearFilterOptions?.label ?? translate("web.clear_all")}
              onClick={filter.clearFilters}
            />
          </ElementTransition>
          <ElementTransition show={filter.canSaveView}>
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              label={filter.saveViewOptions?.label ?? translate("web.save_view")}
              onClick={filter.saveView}
            />
          </ElementTransition>
          <ElementTransition show={filter.canUpdateView}>
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              label={
                isUpdating
                  ? translate("web.confirming")
                  : (filter.updateViewOptions?.label ?? translate("web.update_view"))
              }
              onClick={onUpdate}
              loading={isUpdating}
              disabled={isUpdating}
            />
          </ElementTransition>
        </>
      )}
      {variant === "header" && (
        <Tooltip label={translate("close")}>
          <IconButton
            variant="ghost"
            size="md"
            icon={<CloseOutline />}
            aria-label={translate("close")}
            onClick={() => filter.toggleVisibility(false)}
          />
        </Tooltip>
      )}
    </div>
  );
});

type TFiltersRowMainContentProps<K extends TFilterProperty, E extends TExternalFilter> = {
  buttonConfig?: TAddFilterButtonProps<K, E>["buttonConfig"];
  disabledAllOperations: boolean;
  filter: IFilterInstance<K, E>;
  hasAnyConditions: boolean;
  isUpdating: boolean;
  onUpdate: () => void;
  variant: TFiltersRowVariant;
};

function FiltersRowMainContent<K extends TFilterProperty, E extends TExternalFilter>(
  props: TFiltersRowMainContentProps<K, E>
) {
  const { buttonConfig, disabledAllOperations, filter, hasAnyConditions, isUpdating, onUpdate, variant } = props;

  return (
    <div
      data-filter-toolbar
      className={cn("flex w-full items-center gap-2 rounded-lg bg-layer-1", variant === "modal" ? "p-2" : "px-4 py-2")}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <FiltersRowLeftContent
          buttonConfig={buttonConfig}
          disabledAllOperations={disabledAllOperations}
          filter={filter}
          hasAnyConditions={hasAnyConditions}
          variant={variant}
        />
      </div>
      <FiltersRowActions
        disabledAllOperations={disabledAllOperations}
        filter={filter}
        isUpdating={isUpdating}
        onUpdate={onUpdate}
        variant={variant}
      />
    </div>
  );
}

export const FiltersRow = observer(function FiltersRow<K extends TFilterProperty, E extends TExternalFilter>(
  props: TFiltersRowProps<K, E>
) {
  const { buttonConfig, disabledAllOperations: disabledAllOperationsProp = false, filter, variant = "header" } = props;
  // states
  const [isUpdating, setIsUpdating] = useState(false);
  // derived values
  const disabledAllOperations = disabledAllOperationsProp || !filter.configManager.areConfigsReady;
  const hasAnyConditions = filter.allConditionsForDisplay.length > 0;

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    try {
      await filter.updateView();
    } finally {
      setTimeout(() => setIsUpdating(false), 240); // To avoid flickering
    }
  }, [filter]);

  if (!filter.configManager.areConfigsReady && !hasAnyConditions) {
    return (
      <RowTransition show={filter.isVisible}>
        <Loader>
          <Loader.Item height="44px" width="100%" className={cn({ "rounded-none": variant === "header" })} />
        </Loader>
      </RowTransition>
    );
  }

  const mainContent = (
    <FiltersRowMainContent
      buttonConfig={buttonConfig}
      disabledAllOperations={disabledAllOperations}
      filter={filter}
      hasAnyConditions={hasAnyConditions}
      isUpdating={isUpdating}
      onUpdate={handleUpdate}
      variant={variant}
    />
  );

  return (
    <RowTransition show={filter.isVisible}>
      {variant === "modal" ? (
        mainContent
      ) : (
        <Header variant={EHeaderVariant.TERNARY} className="min-h-11 bg-surface-1 !px-3">
          {mainContent}
        </Header>
      )}
    </RowTransition>
  );
});
