/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Popover } from "@base-ui/react/popover";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Avatar } from "@makeplane/propel/components/avatar";
import { FilterOutline, SelectedFilterOutline } from "@makeplane/propel/icons";
import { PriorityIcon, StateGroupIcon } from "@plane/blocks/icons";
import { MenuPanel, MenuRow, NestedSubmenu } from "@plane/blocks/select";
import { DATE_AFTER_FILTER_OPTIONS, ISSUE_PRIORITIES } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IIssueFilterOptions, IState, TProjectIssueType } from "@plane/types";
import { getFileURL, isInDateFormat } from "@plane/utils";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";
import { FilterMenuOptions } from "@/components/common/filters/filter-menu-options";
import type { FilterMenuOption } from "@/components/common/filters/filter-menu-options";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { useMember } from "@/hooks/store/use-member";

type TSubIssueFiltersProps = {
  handleFiltersUpdate: (filters: IIssueFilterOptions) => void;
  filters: IIssueFilterOptions;
  memberIds: string[] | undefined;
  states?: IState[];
  issueTypes?: TProjectIssueType[];
  availableFilters: (keyof IIssueFilterOptions)[];
};

type DateField = "start_date" | "target_date";

export const SubIssueFilters = observer(function SubIssueFilters({
  handleFiltersUpdate,
  filters,
  memberIds,
  states,
  issueTypes,
  availableFilters,
}: TSubIssueFiltersProps) {
  const { t } = useTranslation();
  const { getUserDetails } = useMember();
  const [customDateField, setCustomDateField] = useState<DateField | null>(null);
  const dateOptions = DATE_AFTER_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.name }));
  const fields: Partial<Record<keyof IIssueFilterOptions, { label: string; options: FilterMenuOption[] }>> = {
    priority: {
      label: t("web.priority"),
      options: ISSUE_PRIORITIES.map((option) => ({
        value: option.key,
        label: option.title,
        icon: <PriorityIcon priority={option.key} className="size-3.5" />,
      })),
    },
    state: {
      label: t("web.state"),
      options: (states ?? []).map((state) => ({
        value: state.id,
        label: state.name,
        icon: <StateGroupIcon stateGroup={state.group} color={state.color} icon={state.icon} />,
      })),
    },
    issue_type: {
      label: t("web.workflow_ui.issue_types"),
      options: (issueTypes ?? []).map((type) => ({ value: type.id, label: type.name })),
    },
    assignees: {
      label: t("web.assignees"),
      options: (memberIds ?? []).flatMap((id) => {
        const member = getUserDetails(id);
        return member
          ? [
              {
                value: id,
                label: member.display_name,
                icon: (
                  <Avatar
                    size="xs"
                    alt={member.display_name}
                    fallback={member.display_name[0]}
                    src={getFileURL(member.avatar_url)}
                  />
                ),
              },
            ]
          : [];
      }),
    },
    start_date: { label: t("web.start_date"), options: dateOptions },
    target_date: { label: t("web.target_date"), options: dateOptions },
  };
  const toggle = (field: keyof IIssueFilterOptions, value: string) => {
    const current = filters[field] ?? [];
    handleFiltersUpdate({
      [field]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    });
  };
  const active = availableFilters.some((field) => (filters[field]?.length ?? 0) > 0);

  return (
    <>
      <Popover.Root>
        <Popover.Trigger
          render={
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={t("common.filters")}
              icon={<Icon icon={active ? SelectedFilterOutline : FilterOutline} />}
            />
          }
        />
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={16} className="z-60">
            <Popover.Popup
              aria-label={t("common.filters")}
              render={
                <MenuPanel className="max-h-[var(--available-height,calc(100dvh-2rem))] w-56 overflow-y-auto overscroll-contain" />
              }
            >
              <NestedSubmenu.Group>
                {availableFilters.map((field) => {
                  const config = fields[field];
                  if (!config) return null;
                  const isDate = field === "start_date" || field === "target_date";
                  const selected = filters[field] ?? [];
                  const customDates = isDate ? selected.filter((value) => isInDateFormat(value.split(";")[0])) : [];
                  return (
                    <NestedSubmenu
                      key={field}
                      id={field}
                      trigger={
                        <>
                          <FilterFieldIcon field={field === "assignees" ? "assignee" : field} />
                          <span className="truncate">{config.label}</span>
                          {selected.length > 0 && <span className="ml-auto text-tertiary">{selected.length}</span>}
                        </>
                      }
                    >
                      <FilterMenuOptions
                        options={
                          isDate ? [...config.options, { value: "custom", label: t("web.custom") }] : config.options
                        }
                        selected={[...selected, ...(customDates.length ? ["custom"] : [])]}
                        onSelect={(value) => {
                          if (isDate && value === "custom") {
                            if (customDates.length)
                              handleFiltersUpdate({
                                [field]: selected.filter((item) => !isInDateFormat(item.split(";")[0])),
                              });
                            else setCustomDateField(field);
                          } else toggle(field, value);
                        }}
                      />
                    </NestedSubmenu>
                  );
                })}
              </NestedSubmenu.Group>
              {active && (
                <MenuRow
                  render={<button type="button" aria-label={t("common.clear_all")} />}
                  className="h-8 text-body-xs-regular text-secondary"
                  onClick={() => handleFiltersUpdate(Object.fromEntries(availableFilters.map((field) => [field, []])))}
                >
                  {t("common.clear_all")}
                </MenuRow>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {customDateField && (
        <DateFilterModal
          isOpen
          title={fields[customDateField]!.label}
          handleClose={() => setCustomDateField(null)}
          onSelect={(dates) => {
            const presets = (filters[customDateField] ?? []).filter((value) => !isInDateFormat(value.split(";")[0]));
            handleFiltersUpdate({ [customDateField]: [...presets, ...dates] });
            setCustomDateField(null);
          }}
        />
      )}
    </>
  );
});
