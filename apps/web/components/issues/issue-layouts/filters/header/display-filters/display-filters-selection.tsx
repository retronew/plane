/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { observer } from "mobx-react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import {
  MenuCheckboxItem,
  MenuGroup,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
} from "@makeplane/propel/components/menu";
import { Toggle, ToggleLabel } from "@makeplane/propel/elements/toggle";
import {
  ISSUE_DISPLAY_PROPERTIES,
  ISSUE_GROUP_BY_OPTIONS,
  ISSUE_ORDER_BY_OPTIONS,
  SPREADSHEET_PROPERTY_DETAILS,
} from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  ILayoutDisplayFiltersOptions,
  TIssueGroupByOptions,
  TIssueOrderByOptions,
} from "@plane/types";
import { SortMenuItems } from "@/components/common/sort-menu";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";
import styles from "./display-filters-selection.module.css";

type Props = {
  displayFilters: IIssueDisplayFilterOptions | undefined;
  displayProperties: IIssueDisplayProperties;
  handleDisplayFiltersUpdate: (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => void;
  handleDisplayPropertiesUpdate: (updatedDisplayProperties: Partial<IIssueDisplayProperties>) => void;
  layoutDisplayFiltersOptions: ILayoutDisplayFiltersOptions | undefined;
  ignoreGroupedFilters?: Partial<TIssueGroupByOptions>[];
  cycleViewDisabled?: boolean;
  moduleViewDisabled?: boolean;
};

type Translate = ReturnType<typeof useTranslation>["t"];
type DisplayFilterConfiguration = ILayoutDisplayFiltersOptions | undefined;
type DisplayProperty = (typeof ISSUE_DISPLAY_PROPERTIES)[number];
type OrderOption = (typeof ISSUE_ORDER_BY_OPTIONS)[number];

function DisplayChoiceMenu<T extends string | null>({
  label,
  field,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  field: string;
  options: { key: T; title: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const encode = (key: T) => key ?? "__none__";
  const selected = options.find((option) => option.key === value);
  return (
    <MenuSubmenu>
      <MenuSubmenuTrigger
        label={label}
        icon={<FilterFieldIcon field={field} />}
        disabled={disabled}
        trailing={<span className="max-w-32 truncate text-secondary">{selected?.title}</span>}
      />
      <MenuSubmenuContent>
        <div className={styles.choices}>
          <MenuRadioGroup
            value={encode(value)}
            onValueChange={(next) => {
              const option = options.find((item) => encode(item.key) === next);
              if (option) onChange(option.key);
            }}
          >
            {options.map((option) => (
              <MenuRadioItem
                key={encode(option.key)}
                value={encode(option.key)}
                label={option.title}
                icon={<FilterFieldIcon field={option.key ?? "group_by"} />}
                closeOnClick={false}
              />
            ))}
          </MenuRadioGroup>
        </div>
      </MenuSubmenuContent>
    </MenuSubmenu>
  );
}

function getIgnoredGroupBy(
  ignoreGroupedFilters: Partial<TIssueGroupByOptions>[],
  cycleViewDisabled: boolean,
  moduleViewDisabled: boolean
) {
  const ignored = new Set<TIssueGroupByOptions>(ignoreGroupedFilters);
  if (cycleViewDisabled) ignored.add("cycle");
  if (moduleViewDisabled) ignored.add("module");
  return ignored;
}

function getDisplayPropertyOptions(
  configuration: DisplayFilterConfiguration,
  cycleViewDisabled: boolean,
  moduleViewDisabled: boolean
) {
  return ISSUE_DISPLAY_PROPERTIES.filter((property) => {
    if (!configuration?.display_properties?.includes(property.key)) return false;
    if (cycleViewDisabled && property.key === "cycle") return false;
    return !(moduleViewDisabled && property.key === "modules");
  });
}

function getGroupByOptions(
  configuration: DisplayFilterConfiguration,
  ignored: Set<TIssueGroupByOptions>,
  displayFilters: IIssueDisplayFilterOptions | undefined
) {
  const enabledGroupBy = configuration?.display_filters?.group_by ?? [];
  if (enabledGroupBy.length === 0) return [];
  return ISSUE_GROUP_BY_OPTIONS.filter((option) => {
    if (!enabledGroupBy.includes(option.key) || ignored.has(option.key)) return false;
    return !(
      displayFilters?.layout === "kanban" &&
      displayFilters.sub_group_by != null &&
      option.key === displayFilters.sub_group_by
    );
  });
}

function getSubGroupByOptions(
  configuration: DisplayFilterConfiguration,
  ignored: Set<TIssueGroupByOptions>,
  displayFilters: IIssueDisplayFilterOptions | undefined
) {
  if (displayFilters?.layout !== "kanban" || displayFilters.group_by == null) return [];
  return ISSUE_GROUP_BY_OPTIONS.filter(
    (option) =>
      configuration?.display_filters?.sub_group_by?.includes(option.key) &&
      !ignored.has(option.key) &&
      option.key !== displayFilters.group_by
  );
}

function getOrderState(
  configuration: DisplayFilterConfiguration,
  displayFilters: IIssueDisplayFilterOptions | undefined
) {
  const orders = ISSUE_ORDER_BY_OPTIONS.filter((option) =>
    configuration?.display_filters?.order_by?.includes(option.key)
  );
  const orderBy = displayFilters?.order_by ?? "-created_at";
  const orderField = orderBy.replace(/^-/, "");
  const descending = orderBy.startsWith("-");
  // Column headers can sort extra table fields (state, assignees, labels, ...).
  const selectedColumnOrder = Object.values(SPREADSHEET_PROPERTY_DETAILS).find(
    (property) => property?.ascendingOrderKey.replace(/^-/, "") === orderField
  );
  if (orders.length && !orders.some((option) => option.key.replace(/^-/, "") === orderField) && selectedColumnOrder)
    orders.push({ key: orderBy, titleTranslationKey: selectedColumnOrder.i18n_title });
  return { orders, orderField, descending };
}

function getExtras(configuration: DisplayFilterConfiguration) {
  if (!configuration?.extra_options.access) return [];
  return configuration.extra_options.values ?? [];
}

function getNextOrderBy(
  field: string,
  orderField: string,
  descending: boolean,
  orders: OrderOption[]
): TIssueOrderByOptions {
  const selected = orders.find((option) => option.key.replace(/^-/, "") === field)!;
  if (field === "sort_order" || orderField === "sort_order") return selected.key;
  return `${descending ? "-" : ""}${field}` as TIssueOrderByOptions;
}

function getOrderByForDirection(direction: "desc" | "asc", orderField: string) {
  return `${direction === "desc" ? "-" : ""}${orderField}` as TIssueOrderByOptions;
}

function DisplayPropertiesGroup({
  properties,
  displayProperties,
  onUpdate,
  t,
}: {
  properties: DisplayProperty[];
  displayProperties: IIssueDisplayProperties;
  onUpdate: (updated: Partial<IIssueDisplayProperties>) => void;
  t: Translate;
}) {
  return (
    <MenuGroup>
      <MenuLabel>{t("issue.display.properties.label")}</MenuLabel>
      <div className="flex flex-wrap gap-2 px-2 pt-0.5 pb-1.5">
        {properties.map((property) => {
          const label = t(property.titleTranslationKey);
          const checked = Boolean(displayProperties[property.key]);
          return (
            <BaseMenu.CheckboxItem
              key={property.key}
              nativeButton
              data-display-property=""
              checked={checked}
              closeOnClick={false}
              onCheckedChange={(value) => onUpdate({ [property.key]: value })}
              render={<Toggle size="sm" data-pressed={checked ? "" : undefined} />}
            >
              <ToggleLabel>{label}</ToggleLabel>
            </BaseMenu.CheckboxItem>
          );
        })}
      </div>
    </MenuGroup>
  );
}

function DisplayExtras({
  extras,
  displayFilters,
  onUpdate,
  t,
}: {
  extras: ILayoutDisplayFiltersOptions["extra_options"]["values"];
  displayFilters: IIssueDisplayFilterOptions | undefined;
  onUpdate: (updated: Partial<IIssueDisplayFilterOptions>) => void;
  t: Translate;
}) {
  return (
    <>
      {extras.includes("sub_issue") && (
        <MenuCheckboxItem
          label={t("issue.display.extra.show_sub_issues")}
          icon={<FilterFieldIcon field="sub_issue" />}
          checked={displayFilters?.sub_issue ?? true}
          closeOnClick={false}
          onCheckedChange={(sub_issue) => onUpdate({ sub_issue })}
        />
      )}
      {extras.includes("show_empty_groups") && (
        <MenuCheckboxItem
          label={t("issue.display.extra.show_empty_groups")}
          icon={<FilterFieldIcon field="show_empty_groups" />}
          checked={displayFilters?.show_empty_groups ?? true}
          closeOnClick={false}
          onCheckedChange={(show_empty_groups) => onUpdate({ show_empty_groups })}
        />
      )}
    </>
  );
}

export const DisplayFiltersSelection = observer(function DisplayFiltersSelection(props: Props) {
  const {
    displayFilters,
    displayProperties,
    handleDisplayFiltersUpdate,
    handleDisplayPropertiesUpdate,
    layoutDisplayFiltersOptions: configuration,
    ignoreGroupedFilters = [],
    cycleViewDisabled = false,
    moduleViewDisabled = false,
  } = props;
  const { t } = useTranslation();
  const ignored = getIgnoredGroupBy(ignoreGroupedFilters, cycleViewDisabled, moduleViewDisabled);
  const properties = getDisplayPropertyOptions(configuration, cycleViewDisabled, moduleViewDisabled);
  const groups = getGroupByOptions(configuration, ignored, displayFilters);
  const subgroups = getSubGroupByOptions(configuration, ignored, displayFilters);
  const { orders, orderField, descending } = getOrderState(configuration, displayFilters);
  const extras = getExtras(configuration);

  return (
    <div className={styles.menu}>
      {properties.length > 0 && (
        <>
          <DisplayPropertiesGroup
            properties={properties}
            displayProperties={displayProperties}
            onUpdate={handleDisplayPropertiesUpdate}
            t={t}
          />
          {(groups.length > 0 || orders.length > 0) && <MenuSeparator />}
        </>
      )}
      {groups.length > 0 && (
        <DisplayChoiceMenu
          field="group_by"
          label={t("common.group_by")}
          value={displayFilters?.group_by ?? null}
          options={groups.map((option) => ({ key: option.key, title: t(option.titleTranslationKey) }))}
          onChange={(group_by) => handleDisplayFiltersUpdate({ group_by })}
        />
      )}
      {subgroups.length > 0 && (
        <DisplayChoiceMenu
          field="sub_group_by"
          label={t("web.sub_group_by")}
          value={displayFilters?.sub_group_by ?? null}
          options={subgroups.map((option) => ({ key: option.key, title: t(option.titleTranslationKey) }))}
          onChange={(sub_group_by) => handleDisplayFiltersUpdate({ sub_group_by })}
        />
      )}
      {orders.length > 0 && (
        <SortMenuItems
          field={orderField}
          direction={descending ? "desc" : "asc"}
          options={orders.map((option) => ({
            value: option.key.replace(/^-/, ""),
            label: t(option.titleTranslationKey),
          }))}
          onFieldChange={(field) => {
            const next = getNextOrderBy(field, orderField, descending, orders);
            handleDisplayFiltersUpdate({ order_by: next });
          }}
          directionDisabled={orderField === "sort_order"}
          onDirectionChange={(direction) =>
            handleDisplayFiltersUpdate({ order_by: getOrderByForDirection(direction, orderField) })
          }
        />
      )}

      {extras.length > 0 && (
        <>
          {(properties.length > 0 || groups.length > 0 || orders.length > 0) && <MenuSeparator />}
          <DisplayExtras extras={extras} displayFilters={displayFilters} onUpdate={handleDisplayFiltersUpdate} t={t} />
        </>
      )}
    </div>
  );
});
