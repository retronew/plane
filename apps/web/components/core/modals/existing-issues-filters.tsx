import { useState } from "react";
import type { ReactNode, ReactElement } from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Popover, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Button } from "@makeplane/propel/components/button";
import { FilterOutline, TickOutline } from "@makeplane/propel/icons";
import { MenuPanel, MenuRow, NestedSubmenu } from "@plane/blocks/select";
import { PriorityIcon, StateGroupIcon } from "@plane/blocks/icons";
import { DATE_AFTER_FILTER_OPTIONS, ISSUE_PRIORITIES, STATE_GROUPS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { FilterItem } from "@/components/rich-filters/filter-item/root";
import { createExistingIssueFilterInstance } from "./existing-issues-filter-adapter";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";

export type ExistingIssueFilters = {
  state_group: string[];
  priority: string[];
  start_date: string[];
  target_date: string[];
};
export const emptyExistingIssueFilters = (): ExistingIssueFilters => ({
  state_group: [],
  priority: [],
  start_date: [],
  target_date: [],
});

type Field = keyof ExistingIssueFilters;
type Props = { value: ExistingIssueFilters; onChange: (value: ExistingIssueFilters) => void };

export function ExistingIssuesFilters({ value, onChange, children }: Props & { children?: ReactNode }) {
  const { t } = useTranslation();
  const filter = createExistingIssueFilterInstance(value, onChange);
  const [customDateField, setCustomDateField] = useState<"start_date" | "target_date" | null>(null);
  const labels: Record<Field, string> = {
    state_group: t("web.state_group"),
    priority: t("web.priority"),
    start_date: t("web.start_date"),
    target_date: t("web.target_date"),
  };
  const toggle = (field: Field, option: string) =>
    onChange({
      ...value,
      [field]: value[field].includes(option)
        ? value[field].filter((item) => item !== option)
        : [...value[field], option],
    });
  const options = (field: Field) => {
    if (field === "state_group")
      return Object.values(STATE_GROUPS).map((item) => ({
        value: item.key,
        label: item.label,
        icon: <StateGroupIcon stateGroup={item.key} />,
      }));
    if (field === "priority")
      return ISSUE_PRIORITIES.map((item) => ({
        value: item.key,
        label: item.title,
        icon: <PriorityIcon priority={item.key} className="size-3.5" />,
      }));
    return DATE_AFTER_FILTER_OPTIONS.map((item) => ({ value: item.value, label: item.name, icon: null }));
  };
  const selectedOptions = Object.fromEntries(
    Object.entries(value).map(([field, items]) => [field, new Set(items)])
  ) as Record<Field, Set<string>>;
  const renderOptions = (field: Field) => (
    <>
      {options(field).map((option) => (
        <MenuRow
          key={option.value}
          render={
            <button type="button" aria-label={option.label} aria-pressed={selectedOptions[field].has(option.value)} />
          }
          onClick={() => toggle(field, option.value)}
          className="h-8 text-body-xs-regular text-primary"
        >
          <span className="flex min-w-0 items-center gap-2">
            {option.icon}
            <span className="truncate">{option.label}</span>
          </span>
          {selectedOptions[field].has(option.value) && (
            <TickOutline className="ml-auto size-3.5 text-accent-primary" aria-hidden="true" />
          )}
        </MenuRow>
      ))}
      {(field === "start_date" || field === "target_date") && (
        <MenuRow
          render={<button type="button" aria-label={t("web.custom")} />}
          onClick={() => setCustomDateField(field)}
          className="h-8 text-body-xs-regular text-primary"
        >
          {t("web.custom")}
        </MenuRow>
      )}
    </>
  );
  const hasFilters = Object.values(value).some((items) => items.length > 0);
  return (
    <>
      <div className="flex items-center gap-3 border-b border-subtle pr-4" data-candidate-search-toolbar>
        <div className="min-w-0 flex-1 [&>div]:border-b-0">{children}</div>
        <CandidateFilterMenu
          label={t("common.filters")}
          trigger={
            <Button size="sm" variant="secondary" stretch="auto" label={t("common.filters")} icon={<FilterOutline />} />
          }
        >
          <NestedSubmenu.Group>
            {(Object.keys(labels) as Field[]).map((field) => (
              <NestedSubmenu key={field} id={field} trigger={<span>{labels[field]}</span>}>
                {renderOptions(field)}
              </NestedSubmenu>
            ))}
          </NestedSubmenu.Group>
        </CandidateFilterMenu>
      </div>
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 bg-layer-1 px-4 py-3" data-candidate-filter-conditions>
          {filter.allConditionsForDisplay.map((condition) => (
            <FilterItem key={condition.id} condition={condition} filter={filter} showTransition={false} />
          ))}
          <Button
            size="sm"
            variant="ghost"
            stretch="auto"
            label={t("common.clear_all")}
            onClick={() => onChange(emptyExistingIssueFilters())}
          />
        </div>
      )}
      {customDateField && (
        <DateFilterModal
          isOpen
          handleClose={() => setCustomDateField(null)}
          title={labels[customDateField]}
          onSelect={(dates) => {
            onChange({ ...value, [customDateField]: dates });
            setCustomDateField(null);
          }}
        />
      )}
    </>
  );
}

function CandidateFilterMenu({
  label,
  trigger,
  children,
}: {
  label: string;
  trigger: ReactElement;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger aria-label={label} render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
          <BasePopover.Popup render={<MenuPanel className="w-64" />}>{children}</BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </Popover>
  );
}
