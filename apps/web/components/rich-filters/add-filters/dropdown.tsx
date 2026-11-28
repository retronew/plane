import { FilterFieldIcon } from "@/components/common/filters/field-icon";
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { ChevronLeftOutline, ChevronRightOutline, TickOutline } from "@makeplane/propel/icons";
import { MenuPanel, MenuRow, MenuSearchInput } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IFilterInstance } from "@plane/shared-state";
import type {
  IFilterOption,
  SingleOrArray,
  TExternalFilter,
  TFilterProperty,
  TFilterValue,
  TSupportedFilterFieldConfigs,
  TSupportedOperators,
} from "@plane/types";
import { FILTER_FIELD_TYPE } from "@plane/types";
import { cn, getOperatorForPayload, toFilterArray } from "@plane/utils";

export type TAddFilterDropdownProps<P extends TFilterProperty, E extends TExternalFilter> = {
  customButton: React.ReactNode;
  triggerAriaLabel?: string;
  buttonConfig?: { className?: string; defaultOpen?: boolean; isDisabled?: boolean };
  filter: IFilterInstance<P, E>;
  keepOpenOnMultiSelect?: boolean;
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

type TDrillInOptionsViewProps = {
  config: TSupportedFilterFieldConfigs;
  selectedValues: Set<string>;
  isMultiSelect: boolean;
  onSelect: (value: TFilterValue) => void;
  onBack: () => void;
};

function DrillInOptionsView({ config, selectedValues, isMultiSelect, onSelect, onBack }: TDrillInOptionsViewProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<IFilterOption<TFilterValue>[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async (retryAttempt: number) => {
      await Promise.resolve(retryAttempt);
      if (!active) return;
      setStatus("loading");
      try {
        const values =
          "getOptions" in config
            ? typeof config.getOptions === "function"
              ? await config.getOptions()
              : config.getOptions
            : [];
        if (active) {
          setOptions(values);
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("error");
      }
    };
    void load(attempt);
    return () => {
      active = false;
    };
  }, [config, attempt]);

  const normalized = query.trim().toLowerCase();
  const visible = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`.toLowerCase().includes(normalized)
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDownCapture={(event) => {
        if (
          (event.key === "Backspace" && query === "" && event.target instanceof HTMLInputElement) ||
          (event.key === "ArrowLeft" && !(event.target instanceof HTMLInputElement))
        ) {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <MenuSearchInput value={query} onChange={setQuery} placeholder={t("search")} />
      <div className="min-h-0 flex-1 overflow-y-auto p-1" aria-live="polite">
        {status === "loading" ? (
          <p className="px-2 py-2 text-body-xs-regular text-tertiary">{t("common.loading")}</p>
        ) : status === "error" ? (
          <div className="p-2 text-body-xs-regular text-tertiary">
            {t("common.filter_fields.load_error")}
            <button type="button" className="ml-2 text-accent-primary" onClick={() => setAttempt((value) => value + 1)}>
              {t("common.retry")}
            </button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-2 py-2 text-body-xs-regular text-tertiary">{t("common.search.no_matching_results")}</p>
        ) : (
          visible.map((option) => {
            const isSelected = selectedValues.has(String(option.value));
            return (
              <MenuRow
                key={option.id}
                disabled={option.disabled}
                render={
                  <button
                    type="button"
                    disabled={option.disabled}
                    aria-label={option.label}
                    aria-pressed={isMultiSelect ? isSelected : undefined}
                  />
                }
                onClick={() => onSelect(option.value)}
                className="h-8 text-body-xs-regular text-primary"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {option.icon && (
                    <span className="inline-flex size-4 shrink-0 items-center justify-center leading-none">
                      {option.icon}
                    </span>
                  )}
                  <span className="truncate">{option.label}</span>
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1.5">
                  {option.description && <span className="max-w-20 truncate text-tertiary">{option.description}</span>}
                  {isSelected && <TickOutline className="size-3.5 text-accent-primary" />}
                </span>
              </MenuRow>
            );
          })
        )}
      </div>
    </div>
  );
}

export const AddFilterDropdown = observer(function AddFilterDropdown<
  P extends TFilterProperty,
  E extends TExternalFilter,
>(props: TAddFilterDropdownProps<P, E>) {
  const { filter, customButton, triggerAriaLabel, buttonConfig, keepOpenOnMultiSelect = false } = props;
  const { className, defaultOpen = false, isDisabled = false } = buttonConfig || {};
  const [open, setOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFieldId, setActiveFieldId] = useState<P | null>(null);
  const { t } = useTranslation();

  const availableConfigs = filter.configManager.allAvailableConfigs;
  const query = searchQuery.trim().toLowerCase();

  // Keep active drill-in config resolved even after its first value is added to filter.allConditions.
  const activeConfig = activeFieldId ? filter.configManager.getConfigByProperty(activeFieldId) : undefined;
  const activeField = activeConfig?.firstOperator
    ? activeConfig.getOperatorConfig(activeConfig.firstOperator)
    : undefined;
  const isActiveMultiSelect = activeField?.type === FILTER_FIELD_TYPE.MULTI_SELECT;

  const existingConditionForActive = activeFieldId
    ? filter.allConditions.find((condition) => condition.property === activeFieldId)
    : undefined;
  const activeSelectedSet = useMemo(() => {
    if (!existingConditionForActive) return new Set<string>();
    return new Set(toFilterArray(existingConditionForActive.value).map(String));
  }, [existingConditionForActive]);

  const visibleConfigs = availableConfigs.filter((config) => config.label.toLowerCase().includes(query));

  // Cross-field value matches: only scans synchronous option arrays so async loaders remain strictly lazy.
  const crossFieldMatches = useMemo<TCrossFieldMatch<P>[]>(() => {
    if (!query) return [];
    const matches: TCrossFieldMatch<P>[] = [];
    for (const config of availableConfigs) {
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
  }, [availableConfigs, query]);

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

    if (stayOpen && isMulti && value !== undefined) {
      const existing = filter.allConditions.find((condition) => condition.property === property);
      if (existing) {
        const currentValues = toFilterArray(existing.value).map(String);
        const targetStr = String(value);
        const nextValues = currentValues.includes(targetStr)
          ? currentValues.filter((item) => item !== targetStr)
          : [...currentValues, targetStr];
        if (nextValues.length === 0) {
          filter.removeCondition(existing.id);
        } else {
          filter.updateConditionValue(existing.id, nextValues as SingleOrArray<TFilterValue>);
        }
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

  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearchQuery("");
          setActiveFieldId(null);
        }
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
                className="flex max-h-[var(--available-height,calc(100dvh-2rem))] w-64 flex-col overflow-hidden"
              />
            }
            onKeyDownCapture={(event) => {
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
            {activeConfig && activeField && "getOptions" in activeField ? (
              <div className="flex max-h-[var(--available-height,calc(100dvh-2rem))] min-h-0 flex-col">
                <div className="flex items-center justify-between gap-1 border-b border-subtle px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveFieldId(null)}
                    className="flex min-w-0 cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-body-xs-medium text-secondary hover:bg-layer-transparent-hover hover:text-primary"
                  >
                    <ChevronLeftOutline className="size-3.5 shrink-0" />
                    <span className="truncate">{activeConfig.label}</span>
                  </button>
                  {keepOpenOnMultiSelect && isActiveMultiSelect && activeSelectedSet.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="shrink-0 cursor-pointer rounded-sm px-2 py-0.5 text-caption-md-medium text-accent-primary hover:bg-accent-subtle"
                    >
                      {t("common.done")} ({activeSelectedSet.size})
                    </button>
                  )}
                </div>
                <DrillInOptionsView
                  key={activeConfig.id}
                  config={activeField}
                  selectedValues={activeSelectedSet}
                  isMultiSelect={Boolean(keepOpenOnMultiSelect && isActiveMultiSelect)}
                  onSelect={(value) => select(activeConfig.id, value, Boolean(keepOpenOnMultiSelect))}
                  onBack={() => setActiveFieldId(null)}
                />
              </div>
            ) : (
              <>
                <MenuSearchInput placeholder={t("search")} value={searchQuery} onChange={setSearchQuery} />
                <div className="min-h-0 overflow-y-auto p-1">
                  {visibleConfigs.map((config) => {
                    const field = config.firstOperator ? config.getOperatorConfig(config.firstOperator) : undefined;
                    const hasOptions = Boolean(field && "getOptions" in field);
                    return (
                      <div key={config.id} data-filter-field>
                        <MenuRow
                          render={<button type="button" aria-label={config.label} />}
                          className="h-8 text-body-xs-regular text-primary"
                          onClick={() => {
                            if (hasOptions) setActiveFieldId(config.id);
                            else select(config.id);
                          }}
                          onKeyDown={(event) => {
                            if (hasOptions && event.key === "ArrowRight") {
                              event.preventDefault();
                              setActiveFieldId(config.id);
                            }
                          }}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {config.icon ? (
                              <config.icon className="size-4 shrink-0 text-icon-tertiary" />
                            ) : (
                              <FilterFieldIcon field={config.id} className="size-4 shrink-0 text-icon-tertiary" />
                            )}
                            <span className="truncate">{config.label}</span>
                          </span>
                          {hasOptions && <ChevronRightOutline className="size-3.5 shrink-0 text-icon-tertiary" />}
                        </MenuRow>
                      </div>
                    );
                  })}

                  {crossFieldMatches.length > 0 && (
                    <div className={cn(visibleConfigs.length > 0 && "mt-1 border-t border-subtle pt-1")}>
                      {crossFieldMatches.map((match) => (
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
                          <span className="ml-2 max-w-20 shrink-0 truncate text-caption-md-regular text-tertiary">
                            {match.fieldLabel}
                          </span>
                        </MenuRow>
                      ))}
                    </div>
                  )}

                  {visibleConfigs.length === 0 && crossFieldMatches.length === 0 && (
                    <p className="px-2 py-2 text-body-xs-regular text-tertiary">
                      {availableConfigs.length === 0
                        ? t("web.all_filters_applied")
                        : t("common.search.no_matching_results")}
                    </p>
                  )}
                </div>
              </>
            )}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
});
