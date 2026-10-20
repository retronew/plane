import { useState } from "react";
import { observer } from "mobx-react";
import { Popover } from "@base-ui/react/popover";
import { TickOutline } from "@makeplane/propel/icons";
import { FilterToggleButton } from "@/components/common/filter-toggle-button";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { DATE_AFTER_FILTER_OPTIONS, MODULE_STATUS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ModuleStatusIcon } from "@plane/blocks/icons";
import { MenuPanel, MenuRow, MenuSearchInput, NestedSubmenu } from "@plane/blocks/select";
import type { TModuleDisplayFilters, TModuleFilters } from "@plane/types";
import { getFileURL, isInDateFormat } from "@plane/utils";
import { FilterMenuOptions, type FilterMenuOption } from "@/components/common/filters/filter-menu-options";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { useMember } from "@/hooks/store/use-member";

type Props = {
  displayFilters: TModuleDisplayFilters;
  filters: TModuleFilters;
  handleDisplayFiltersUpdate: (updatedDisplayProperties: Partial<TModuleDisplayFilters>) => void;
  handleFiltersUpdate: (key: keyof TModuleFilters, value: string | string[]) => void;
  memberIds?: string[];
  isArchived?: boolean;
};

type Option = FilterMenuOption;

export const ModuleFiltersSelection = observer(function ModuleFiltersSelection({
  displayFilters,
  filters,
  handleDisplayFiltersUpdate,
  handleFiltersUpdate,
  memberIds,
  isArchived = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [dateField, setDateField] = useState<"start_date" | "target_date" | null>(null);
  const { getUserDetails } = useMember();
  const { t } = useTranslation();
  const members: Option[] = (memberIds ?? []).flatMap((id) => {
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
  });
  const fields: { key: keyof TModuleFilters; label: string; options: Option[] }[] = [
    ...(!isArchived
      ? [
          {
            key: "status" as const,
            label: t("web.status"),
            options: MODULE_STATUS.map((status) => ({
              value: status.value,
              label: t(status.i18n_label),
              icon: <ModuleStatusIcon status={status.value} />,
            })),
          },
        ]
      : []),
    { key: "lead", label: t("lead"), options: members },
    { key: "members", label: t("members"), options: members },
    ...(["start_date", "target_date"] as const).map((key) => ({
      key,
      label: t(key === "start_date" ? "web.start_date" : "web.due_date"),
      options: [
        ...DATE_AFTER_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.name })),
        { value: "custom", label: t("web.custom") },
      ],
    })),
  ];
  const favoritesVisible = !isArchived && t("web.favorites").toLowerCase().includes(query.trim().toLowerCase());
  const visible = fields.filter((field) => field.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <>
      <MenuSearchInput value={query} onChange={setQuery} placeholder={t("search")} />
      <div className="min-h-0 overflow-y-auto p-1">
        <NestedSubmenu.Group>
          {favoritesVisible && (
            <MenuRow
              render={
                <button type="button" aria-label={t("web.favorites")} aria-pressed={!!displayFilters.favorites} />
              }
              className="h-8 text-body-xs-regular text-primary"
              onClick={() => handleDisplayFiltersUpdate({ favorites: !displayFilters.favorites })}
            >
              <span className="flex items-center gap-2">
                <FilterFieldIcon field="favorites" />
                {t("web.favorites")}
              </span>
              {displayFilters.favorites && <TickOutline className="size-4" />}
            </MenuRow>
          )}
          {visible.map((field) => (
            <div key={field.key} data-filter-field>
              <NestedSubmenu
                id={field.key}
                trigger={
                  <>
                    <FilterFieldIcon field={field.key} className="size-4 shrink-0 text-icon-tertiary" />
                    <span className="truncate">{field.label}</span>
                  </>
                }
              >
                <FilterMenuOptions
                  options={field.options}
                  selected={[
                    ...(filters[field.key] ?? []),
                    ...((filters[field.key] ?? []).some((value) => isInDateFormat(value.split(";")[0]))
                      ? ["custom"]
                      : []),
                  ]}
                  onSelect={(value) => {
                    if (value === "custom" && (field.key === "start_date" || field.key === "target_date"))
                      setDateField(field.key);
                    else handleFiltersUpdate(field.key, value);
                  }}
                />
              </NestedSubmenu>
            </div>
          ))}
        </NestedSubmenu.Group>
        {visible.length === 0 && !favoritesVisible && (
          <p className="px-2 py-2 text-body-xs-regular text-tertiary">{t("common.search.no_matching_results")}</p>
        )}
      </div>
      {dateField && (
        <DateFilterModal
          isOpen
          handleClose={() => setDateField(null)}
          title={t(dateField === "start_date" ? "web.start_date" : "web.due_date")}
          onSelect={(value) => handleFiltersUpdate(dateField, value)}
        />
      )}
    </>
  );
});

export function ModuleFiltersDropdown(props: Props & { isFiltersApplied?: boolean }) {
  const { t } = useTranslation();
  return (
    <Popover.Root>
      <Tooltip label={t("common.filters")} side="bottom">
        <span className="inline-flex">
          <Popover.Trigger
            render={<FilterToggleButton size="md" active={!!props.isFiltersApplied} aria-label={t("common.filters")} />}
          />
        </span>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={4} collisionPadding={16} className="z-60">
          <Popover.Popup
            aria-label={t("common.filters")}
            render={
              <MenuPanel
                flush
                className="flex max-h-[var(--available-height,calc(100dvh-2rem))] w-56 flex-col overflow-hidden"
              />
            }
          >
            <ModuleFiltersSelection {...props} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
