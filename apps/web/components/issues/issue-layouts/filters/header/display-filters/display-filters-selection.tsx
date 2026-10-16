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
  isEpic?: boolean;
};

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
    isEpic = false,
  } = props;
  const { t } = useTranslation();
  const enabledFilters = configuration?.display_filters ?? {};
  const ignored = new Set<TIssueGroupByOptions>([
    ...ignoreGroupedFilters,
    ...(cycleViewDisabled ? ["cycle" as const] : []),
    ...(moduleViewDisabled ? ["module" as const] : []),
  ]);
  const properties = ISSUE_DISPLAY_PROPERTIES.filter(
    (property) =>
      configuration?.display_properties?.includes(property.key) &&
      !(cycleViewDisabled && property.key === "cycle") &&
      !(moduleViewDisabled && property.key === "modules")
  );
  const groups =
    (enabledFilters.group_by ?? []).length > 0
      ? ISSUE_GROUP_BY_OPTIONS.filter(
          (option) =>
            enabledFilters.group_by?.includes(option.key) &&
            !ignored.has(option.key) &&
            !(
              displayFilters?.layout === "kanban" &&
              displayFilters.sub_group_by != null &&
              option.key === displayFilters.sub_group_by
            )
        )
      : [];
  const subgroups =
    displayFilters?.layout === "kanban" && displayFilters.group_by != null
      ? ISSUE_GROUP_BY_OPTIONS.filter(
          (option) =>
            enabledFilters.sub_group_by?.includes(option.key) &&
            !ignored.has(option.key) &&
            option.key !== displayFilters.group_by
        )
      : [];
  const orders = ISSUE_ORDER_BY_OPTIONS.filter((option) => enabledFilters.order_by?.includes(option.key));
  const orderBy = displayFilters?.order_by ?? "-created_at";
  const orderField = orderBy.replace(/^-/, "");
  const descending = orderBy.startsWith("-");
  // Column headers can sort extra table fields (state, assignees, labels, ...).
  const selectedColumnOrder = Object.values(SPREADSHEET_PROPERTY_DETAILS).find(
    (property) => property?.ascendingOrderKey.replace(/^-/, "") === orderField
  );
  if (orders.length && !orders.some((option) => option.key.replace(/^-/, "") === orderField) && selectedColumnOrder)
    orders.push({ key: orderBy, titleTranslationKey: selectedColumnOrder.i18n_title });
  const extras = configuration?.extra_options.access ? (configuration.extra_options.values ?? []) : [];
  return (
    <div className={styles.menu}>
      {properties.length > 0 && (
        <>
          <MenuGroup>
            <MenuLabel>{t("issue.display.properties.label")}</MenuLabel>
            <div className="flex flex-wrap gap-2 px-2 pt-0.5 pb-1.5">
              {properties.map((property) => {
                const label = t(
                  isEpic && property.key === "sub_issue_count"
                    ? "issue.display.properties.work_item_count"
                    : property.titleTranslationKey
                );
                const checked = Boolean(displayProperties[property.key]);
                return (
                  <BaseMenu.CheckboxItem
                    key={property.key}
                    nativeButton
                    data-display-property=""
                    checked={checked}
                    closeOnClick={false}
                    onCheckedChange={(value) => handleDisplayPropertiesUpdate({ [property.key]: value })}
                    render={<Toggle size="sm" data-pressed={checked ? "" : undefined} />}
                  >
                    <ToggleLabel>{label}</ToggleLabel>
                  </BaseMenu.CheckboxItem>
                );
              })}
            </div>
          </MenuGroup>
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
            const selected = orders.find((option) => option.key.replace(/^-/, "") === field)!;
            const next =
              field === "sort_order" || orderField === "sort_order" ? selected.key : `${descending ? "-" : ""}${field}`;
            handleDisplayFiltersUpdate({ order_by: next as TIssueOrderByOptions });
          }}
          directionDisabled={orderField === "sort_order"}
          onDirectionChange={(direction) =>
            handleDisplayFiltersUpdate({
              order_by: `${direction === "desc" ? "-" : ""}${orderField}` as TIssueOrderByOptions,
            })
          }
        />
      )}

      {extras.length > 0 && (
        <>
          {(properties.length > 0 || groups.length > 0 || orders.length > 0) && <MenuSeparator />}
          {extras.includes("sub_issue") && (
            <MenuCheckboxItem
              label={t("issue.display.extra.show_sub_issues")}
              icon={<FilterFieldIcon field="sub_issue" />}
              checked={displayFilters?.sub_issue ?? true}
              closeOnClick={false}
              onCheckedChange={(sub_issue) => handleDisplayFiltersUpdate({ sub_issue })}
            />
          )}
          {extras.includes("show_empty_groups") && (
            <MenuCheckboxItem
              label={t("issue.display.extra.show_empty_groups")}
              icon={<FilterFieldIcon field="show_empty_groups" />}
              checked={displayFilters?.show_empty_groups ?? true}
              closeOnClick={false}
              onCheckedChange={(show_empty_groups) => handleDisplayFiltersUpdate({ show_empty_groups })}
            />
          )}
        </>
      )}
    </div>
  );
});
