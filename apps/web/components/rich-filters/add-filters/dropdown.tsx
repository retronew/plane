import { FilterFieldIcon } from "@/components/common/filters/field-icon";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Button } from "@makeplane/propel/components/button";
import { TickOutline } from "@makeplane/propel/icons";
import { MenuPanel, MenuRow, MenuSearchInput, NestedSubmenu } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IFilterInstance } from "@plane/shared-state";
import type {
  IFilterOption,
  SingleOrArray,
  TExternalFilter,
  TFilterProperty,
  TFilterValue,
  TSupportedOperators,
} from "@plane/types";
import { FILTER_FIELD_TYPE } from "@plane/types";
import { cn, getOperatorForPayload, hasValidValue, toFilterArray } from "@plane/utils";
import { QuickFilterOptions } from "./quick-options";

export type TAddFilterDropdownProps<P extends TFilterProperty, E extends TExternalFilter> = {
  customButton: React.ReactNode;
  triggerAriaLabel?: string;
  buttonConfig?: { className?: string; defaultOpen?: boolean; isDisabled?: boolean };
  align?: "start" | "end";
  filter: IFilterInstance<P, E>;
  keepOpenOnMultiSelect?: boolean;
  /**
   * When true, shows all enabled fields with live active counts & checkmarks synced with the
   * applied condition chips below (instead of hiding already-applied fields).
   */
  syncWithApplied?: boolean;
  onClearAll?: () => void;
  handleFilterSelect: (
    property: P,
    operator: TSupportedOperators,
    isNegation: boolean,
    value?: SingleOrArray<TFilterValue>
  ) => void;
};

type TCrossFieldMatch<P extends TFilterProperty> = {
  property: P;
  fieldLabel: string;
  fieldIcon?: React.FC<React.SVGAttributes<SVGElement>>;
  option: IFilterOption<TFilterValue>;
};

const MAX_CROSS_FIELD_MATCHES = 8;

export const AddFilterDropdown = observer(function AddFilterDropdown<
  P extends TFilterProperty,
  E extends TExternalFilter,
>(props: TAddFilterDropdownProps<P, E>) {
  const {
    filter,
    customButton,
    triggerAriaLabel,
    buttonConfig,
    align = "start",
    keepOpenOnMultiSelect = false,
    syncWithApplied = false,
    onClearAll,
  } = props;
  const { className, defaultOpen = false, isDisabled = false } = buttonConfig || {};
  const [open, setOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();

  // In synced mode, keep all enabled fields visible so users can inspect/toggle active filters directly from the hover menu.
  const baseConfigs = syncWithApplied
    ? Array.from(filter.configManager.filterConfigs.values()).filter((config) => config.isEnabled)
    : filter.configManager.allAvailableConfigs;

  const query = searchQuery.trim().toLowerCase();
  const visibleConfigs = baseConfigs.filter((config) => config.label.toLowerCase().includes(query));

  // Build lookup of active conditions & selected values per property for two-way sync with chips below.
  const activeStateByProperty = useMemo(() => {
    const map = new Map<P, { count: number; selectedValues: Set<string> }>();
    for (const condition of filter.allConditions) {
      const entry = map.get(condition.property) ?? { count: 0, selectedValues: new Set<string>() };
      if (Array.isArray(condition.value)) {
        for (const item of condition.value) {
          if (item !== null && item !== undefined && String(item) !== "") {
            entry.selectedValues.add(String(item));
          }
        }
        entry.count = entry.selectedValues.size;
      } else if (hasValidValue(condition.value)) {
        entry.selectedValues.add(String(condition.value));
        entry.count += 1;
      }
      map.set(condition.property, entry);
    }
    return map;
  }, [filter.allConditions]);

  // Cross-field value matches: only scans synchronous option arrays so async loaders remain strictly lazy.
  const crossFieldMatches = useMemo<TCrossFieldMatch<P>[]>(() => {
    if (!query) return [];
    const matches: TCrossFieldMatch<P>[] = [];
    for (const config of baseConfigs) {
      const field = config.firstOperator ? config.getOperatorConfig(config.firstOperator) : undefined;
      if (!field || !("getOptions" in field) || !Array.isArray(field.getOptions)) continue;
      for (const option of field.getOptions) {
        if (option.disabled) continue;
        if (`${option.label} ${option.description ?? ""}`.toLowerCase().includes(query)) {
          matches.push({
            property: config.id,
            fieldLabel: config.label,
            fieldIcon: config.icon,
            option,
          });
          if (matches.length >= MAX_CROSS_FIELD_MATCHES) return matches;
        }
      }
    }
    return matches;
  }, [baseConfigs, query]);

  const select = (property: P, value?: TFilterValue, stayOpen = false) => {
    const config = filter.configManager.getConfigByProperty(property);
    if (!config?.firstOperator) {
      setToast({
        title: t("web.filter_configuration_error"),
        message: t("web.this_filter_is_not_properly_configured_and_cannot_be_applied"),
        type: "error",
      });
      return;
    }

    const { operator, isNegation } = getOperatorForPayload(config.firstOperator);
    const field = config.getOperatorConfig(config.firstOperator);
    const isMulti = field?.type === FILTER_FIELD_TYPE.MULTI_SELECT;

    // Two-way sync with existing condition below: toggle value on/off in place instead of duplicating.
    if (syncWithApplied && !config.allowMultipleFilters) {
      const existing = filter.allConditions.find((condition) => condition.property === property);
      if (existing) {
        if (value === undefined) {
          // Non-select field already exists below: ensure row is visible and close menu to edit chip inline.
          filter.toggleVisibility(true);
          setOpen(false);
          return;
        }
        if (isMulti) {
          const currentValues = toFilterArray(existing.value).map(String);
          const targetStr = String(value);
          const nextValues = currentValues.includes(targetStr)
            ? currentValues.filter((item) => item !== targetStr)
            : [...currentValues, targetStr];
          if (nextValues.length === 0) {
            filter.removeCondition(existing.id);
          } else {
            filter.updateConditionValue(existing.id, nextValues as SingleOrArray<TFilterValue>);
            filter.toggleVisibility(true);
          }
          if (!stayOpen) setOpen(false);
          return;
        }
        // Single-select toggle: clicking the already-selected value removes it, otherwise updates it.
        if (String(existing.value) === String(value)) {
          filter.removeCondition(existing.id);
        } else {
          filter.updateConditionValue(existing.id, value);
          filter.toggleVisibility(true);
        }
        setOpen(false);
        return;
      }
    }

    props.handleFilterSelect(
      property,
      operator,
      isNegation,
      value === undefined ? undefined : isMulti ? ([value] as SingleOrArray<TFilterValue>) : value
    );

    if (!stayOpen || !isMulti) {
      setOpen(false);
    }
  };

  const handleClearFromMenu = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      void filter.clearFilters().then(() => {
        if (!filter.canUpdateView) filter.toggleVisibility(false);
        return undefined;
      });
    }
    setOpen(false);
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
        <BasePopover.Positioner side="bottom" align={align} sideOffset={4} collisionPadding={16} className="z-60">
          <BasePopover.Popup
            aria-label={t("common.filters")}
            render={
              <MenuPanel
                flush
                className="flex max-h-[var(--available-height,calc(100dvh-2rem))] w-60 flex-col overflow-hidden"
              />
            }
            onKeyDownCapture={(event) => {
              // Keep field navigation predictable without interfering with nested value search.
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              if (!event.currentTarget.contains(document.activeElement)) return;
              const rows = [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  "[data-filter-field] > button, [data-filter-field] > [role='button'], [data-filter-quick-match]"
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
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              <NestedSubmenu.Group>
                {visibleConfigs.map((config) => {
                  const field = config.firstOperator ? config.getOperatorConfig(config.firstOperator) : undefined;
                  const activeInfo = syncWithApplied ? activeStateByProperty.get(config.id) : undefined;
                  const activeCount = activeInfo?.count ?? 0;
                  const isMulti = field?.type === FILTER_FIELD_TYPE.MULTI_SELECT;
                  const content = (
                    <>
                      {config.icon ? (
                        <config.icon
                          className={cn(
                            "size-4 shrink-0",
                            activeCount > 0 ? "text-accent-primary" : "text-icon-tertiary"
                          )}
                        />
                      ) : (
                        <FilterFieldIcon
                          field={config.id}
                          className={cn(
                            "size-4 shrink-0",
                            activeCount > 0 ? "text-accent-primary" : "text-icon-tertiary"
                          )}
                        />
                      )}
                      <span className={cn("truncate", activeCount > 0 && "font-medium text-primary")}>
                        {config.label}
                      </span>
                      {activeCount > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-accent-subtle px-1.5 py-0.5 text-caption-sm-medium leading-none text-accent-primary tabular-nums">
                          {activeCount}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <div key={config.id} data-filter-field>
                      {field && "getOptions" in field ? (
                        <NestedSubmenu id={config.id} trigger={content}>
                          <QuickFilterOptions
                            config={field}
                            selectedValues={activeInfo?.selectedValues}
                            isMultiSelect={Boolean(keepOpenOnMultiSelect && isMulti)}
                            onSelect={(value) => select(config.id, value, Boolean(keepOpenOnMultiSelect))}
                          />
                        </NestedSubmenu>
                      ) : (
                        <MenuRow
                          render={<button type="button" aria-label={config.label} />}
                          className="h-8 text-body-xs-regular text-primary"
                          onClick={() => select(config.id)}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2">{content}</span>
                        </MenuRow>
                      )}
                    </div>
                  );
                })}
              </NestedSubmenu.Group>

              {crossFieldMatches.length > 0 && (
                <div className={cn(visibleConfigs.length > 0 && "mt-1 border-t border-subtle pt-1")}>
                  {crossFieldMatches.map((match) => {
                    const isSelected = Boolean(
                      activeStateByProperty.get(match.property)?.selectedValues.has(String(match.option.value))
                    );
                    return (
                      <MenuRow
                        key={`${match.property}-${match.option.id}`}
                        data-filter-quick-match=""
                        render={<button type="button" aria-label={`${match.fieldLabel}: ${match.option.label}`} />}
                        className="h-8 text-body-xs-regular text-primary"
                        onClick={() => select(match.property, match.option.value, false)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {match.option.icon ? (
                            <span className="inline-flex size-4 shrink-0 items-center justify-center leading-none">
                              {match.option.icon}
                            </span>
                          ) : match.fieldIcon ? (
                            <match.fieldIcon className="size-4 shrink-0 text-icon-tertiary" />
                          ) : (
                            <FilterFieldIcon field={match.property} className="size-4 shrink-0 text-icon-tertiary" />
                          )}
                          <span className="truncate">{match.option.label}</span>
                        </span>
                        <span className="ml-2 flex shrink-0 items-center gap-1">
                          <span className="max-w-20 truncate text-caption-md-regular text-tertiary">
                            {match.fieldLabel}
                          </span>
                          {isSelected && <TickOutline className="size-3.5 text-accent-primary" />}
                        </span>
                      </MenuRow>
                    );
                  })}
                </div>
              )}

              {visibleConfigs.length === 0 && crossFieldMatches.length === 0 && (
                <p className="px-2 py-2 text-body-xs-regular text-tertiary">
                  {baseConfigs.length === 0 ? t("web.all_filters_applied") : t("common.search.no_matching_results")}
                </p>
              )}
            </div>
            {syncWithApplied && filter.canClearFilters && (
              <div className="border-t border-subtle p-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  stretch="fill"
                  label={filter.clearFilterOptions?.label ?? t("web.clear_all")}
                  onClick={handleClearFromMenu}
                />
              </div>
            )}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
});
