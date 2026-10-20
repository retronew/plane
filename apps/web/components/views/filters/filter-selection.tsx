import { useState } from "react";
import { observer } from "mobx-react";
import { Popover } from "@base-ui/react/popover";
import { TickOutline } from "@makeplane/propel/icons";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { DATE_BEFORE_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { MenuPanel, MenuRow, NestedSubmenu } from "@plane/blocks/select";
import { EViewAccess } from "@plane/types";
import type { TViewFilters } from "@plane/types";
import { getFileURL, isInDateFormat } from "@plane/utils";
import { FilterToggleButton } from "@/components/common/filter-toggle-button";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";
import { FilterMenuOptions } from "@/components/common/filters/filter-menu-options";
import { DateFilterModal } from "@/components/core/filters/date-filter-modal";
import { useMember } from "@/hooks/store/use-member";

type Props = {
  filters: TViewFilters;
  handleFiltersUpdate: <T extends keyof TViewFilters>(filterKey: T, filterValue: TViewFilters[T]) => void;
  memberIds?: string[];
};

const ViewFiltersSelection = observer(function ViewFiltersSelection({
  filters,
  handleFiltersUpdate,
  memberIds,
}: Props) {
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const { t } = useTranslation();
  const { getUserDetails } = useMember();
  const toggleFilter = (key: "created_at" | "owned_by", value: string | string[]) => {
    const selected = new Set(filters.filters?.[key] ?? []);
    for (const item of Array.isArray(value) ? value : [value]) {
      if (selected.has(item)) selected.delete(item);
      else selected.add(item);
    }
    handleFiltersUpdate("filters", { ...filters.filters, [key]: [...selected] });
  };
  const dateValues = filters.filters?.created_at ?? [];
  const customDates = dateValues.filter((value) => isInDateFormat(value.split(";")[0]));
  const fields = [
    {
      key: "view_type" as const,
      label: t("web.runtime.view_type"),
      options: [
        { value: String(EViewAccess.PRIVATE), label: t("web.private") },
        { value: String(EViewAccess.PUBLIC), label: t("web.public") },
      ],
    },
    {
      key: "created_at" as const,
      label: t("web.created_date"),
      options: [
        ...DATE_BEFORE_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.name })),
        { value: "custom", label: t("web.custom") },
      ],
    },
    {
      key: "owned_by" as const,
      label: t("web.created_by"),
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
  ];
  return (
    <>
      <div className="min-h-0 overflow-y-auto p-1">
        <NestedSubmenu.Group>
          <MenuRow
            render={
              <button type="button" aria-label={t("web.favorites")} aria-pressed={!!filters.filters?.favorites} />
            }
            className="h-8 text-body-xs-regular text-primary"
            onClick={() =>
              handleFiltersUpdate("filters", { ...filters.filters, favorites: !filters.filters?.favorites })
            }
          >
            <span className="flex items-center gap-2">
              <FilterFieldIcon field="favorites" />
              {t("web.favorites")}
            </span>
            {filters.filters?.favorites && <TickOutline className="size-4" />}
          </MenuRow>
          <hr className="my-1 border-t border-subtle-1" />
          {fields.map((field) => (
            <NestedSubmenu
              key={field.key}
              id={field.key}
              trigger={
                <>
                  <FilterFieldIcon
                    field={field.key === "view_type" ? "access" : field.key}
                    className="size-4 shrink-0 text-icon-tertiary"
                  />
                  <span className="truncate">{field.label}</span>
                </>
              }
            >
              <FilterMenuOptions
                options={field.options}
                selected={[
                  ...(filters.filters?.[field.key] ?? []).map(String),
                  ...(field.key === "created_at" && customDates.length ? ["custom"] : []),
                ]}
                onSelect={(value) => {
                  if (field.key === "view_type") {
                    const access = Number(value) as EViewAccess;
                    const current = filters.filters?.view_type ?? [];
                    handleFiltersUpdate("filters", {
                      ...filters.filters,
                      view_type: current.includes(access)
                        ? current.filter((item) => item !== access)
                        : [...current, access],
                    });
                  } else if (value === "custom") {
                    if (customDates.length) toggleFilter("created_at", customDates);
                    else setDateModalOpen(true);
                  } else toggleFilter(field.key, value);
                }}
              />
            </NestedSubmenu>
          ))}
        </NestedSubmenu.Group>
      </div>
      {dateModalOpen && (
        <DateFilterModal
          isOpen
          handleClose={() => setDateModalOpen(false)}
          title={t("web.created_date")}
          onSelect={(value) => toggleFilter("created_at", value)}
        />
      )}
    </>
  );
});

export function ViewFiltersDropdown(props: Props) {
  const { t } = useTranslation();
  const active = Object.values(props.filters.filters ?? {}).some((value) =>
    Array.isArray(value) ? value.length > 0 : !!value
  );
  return (
    <Popover.Root>
      <Tooltip label={t("common.filters")} side="bottom">
        <span className="inline-flex">
          <Popover.Trigger render={<FilterToggleButton size="md" active={active} aria-label={t("common.filters")} />} />
        </span>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={16} className="z-60">
          <Popover.Popup
            aria-label={t("common.filters")}
            render={
              <MenuPanel
                flush
                className="flex max-h-[var(--available-height,calc(100dvh-2rem))] w-56 flex-col overflow-hidden"
              />
            }
          >
            <ViewFiltersSelection {...props} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
