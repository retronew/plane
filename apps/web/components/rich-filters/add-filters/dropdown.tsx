/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { MenuPanel, MenuRow, MenuSearchInput, NestedSubmenu } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IFilterInstance } from "@plane/shared-state";
import type { SingleOrArray, TFilterValue, TExternalFilter, TFilterProperty, TSupportedOperators } from "@plane/types";
import { FILTER_FIELD_TYPE } from "@plane/types";
import { cn, getOperatorForPayload } from "@plane/utils";
import { QuickFilterOptions } from "./quick-options";

export type TAddFilterDropdownProps<P extends TFilterProperty, E extends TExternalFilter> = {
  customButton: React.ReactNode;
  triggerAriaLabel?: string;
  buttonConfig?: { className?: string; defaultOpen?: boolean; isDisabled?: boolean };
  filter: IFilterInstance<P, E>;
  handleFilterSelect: (
    property: P,
    operator: TSupportedOperators,
    isNegation: boolean,
    value?: SingleOrArray<TFilterValue>
  ) => void;
};

export const AddFilterDropdown = observer(function AddFilterDropdown<
  P extends TFilterProperty,
  E extends TExternalFilter,
>(props: TAddFilterDropdownProps<P, E>) {
  const { filter, customButton, triggerAriaLabel, buttonConfig } = props;
  const { className, defaultOpen = false, isDisabled = false } = buttonConfig || {};
  const [open, setOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();
  const availableConfigs = filter.configManager.allAvailableConfigs;
  const query = searchQuery.trim().toLowerCase();
  const visibleConfigs = availableConfigs.filter((config) => config.label.toLowerCase().includes(query));
  const select = (property: P, value?: TFilterValue) => {
    const config = filter.configManager.getConfigByProperty(property);
    if (config?.firstOperator) {
      const { operator, isNegation } = getOperatorForPayload(config.firstOperator);
      const field = config.getOperatorConfig(config.firstOperator);
      props.handleFilterSelect(
        property,
        operator,
        isNegation,
        value === undefined
          ? undefined
          : field?.type === FILTER_FIELD_TYPE.MULTI_SELECT
            ? ([value] as SingleOrArray<TFilterValue>)
            : value
      );
      setOpen(false);
    } else
      setToast({
        title: t("web.filter_configuration_error"),
        message: t("web.this_filter_is_not_properly_configured_and_cannot_be_applied"),
        type: "error",
      });
  };
  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearchQuery("");
      }}
    >
      <BasePopover.Trigger
        disabled={isDisabled}
        aria-label={triggerAriaLabel}
        className={cn(
          "flex h-full items-center gap-1 text-body-xs-regular outline-none",
          isDisabled ? "cursor-not-allowed text-secondary" : "cursor-pointer hover:bg-layer-transparent-hover",
          className
        )}
      >
        {customButton}
      </BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="start" sideOffset={4} collisionPadding={16} className="z-60">
          <BasePopover.Popup
            aria-label={t("common.filters")}
            render={
              <MenuPanel
                flush
                className="flex max-h-[var(--available-height,calc(100dvh-2rem))] w-56 flex-col overflow-hidden"
              />
            }
            onKeyDownCapture={(event) => {
              // Keep field navigation predictable without interfering with nested value search.
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              if (!event.currentTarget.contains(document.activeElement)) return;
              const rows = [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  "[data-filter-field] > button, [data-filter-field] > [role='button']"
                ),
              ];
              const current = rows.indexOf(document.activeElement as HTMLElement);
              if (rows.length && (current >= 0 || document.activeElement instanceof HTMLInputElement)) {
                event.preventDefault();
                rows[(current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length].focus();
              }
            }}
          >
            <MenuSearchInput placeholder={t("search")} value={searchQuery} onChange={setSearchQuery} />
            <div className="min-h-0 overflow-y-auto p-1">
              <NestedSubmenu.Group>
                {visibleConfigs.map((config) => {
                  const field = config.firstOperator ? config.getOperatorConfig(config.firstOperator) : undefined;
                  const content = (
                    <>
                      {config.icon && <config.icon className="size-4 shrink-0 text-icon-tertiary" />}
                      <span className="truncate">{config.label}</span>
                    </>
                  );
                  return (
                    <div key={config.id} data-filter-field>
                      {field && "getOptions" in field ? (
                        <NestedSubmenu id={config.id} trigger={content}>
                          <QuickFilterOptions config={field} onSelect={(value) => select(config.id, value)} />
                        </NestedSubmenu>
                      ) : (
                        <MenuRow
                          render={<button type="button" aria-label={config.label} />}
                          className="h-8 text-body-xs-regular text-primary"
                          onClick={() => select(config.id)}
                        >
                          <span className="flex items-center gap-2">{content}</span>
                        </MenuRow>
                      )}
                    </div>
                  );
                })}
              </NestedSubmenu.Group>
              {visibleConfigs.length === 0 && (
                <p className="px-2 py-2 text-body-xs-regular text-tertiary">
                  {availableConfigs.length === 0
                    ? t("web.all_filters_applied")
                    : t("common.search.no_matching_results")}
                </p>
              )}
            </div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
});
