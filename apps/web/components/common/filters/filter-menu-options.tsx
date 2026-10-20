import { useState } from "react";
import { TickOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import { MenuRow, MenuSearchInput } from "@plane/blocks/select";

export type FilterMenuOption = { value: string; label: string; icon?: React.ReactNode };

export function FilterMenuOptions({
  options,
  selected,
  onSelect,
}: {
  options: FilterMenuOption[];
  selected: string[];
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { t } = useTranslation();
  const selectedValues = new Set(selected);
  const visible = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="flex max-h-[var(--available-height,calc(100dvh-2rem))] flex-col">
      <MenuSearchInput value={query} onChange={setQuery} placeholder={t("search")} />
      <div className="min-h-0 overflow-y-auto p-1">
        {visible.map((option) => (
          <MenuRow
            key={option.value}
            render={<button type="button" aria-label={option.label} aria-pressed={selectedValues.has(option.value)} />}
            onClick={() => onSelect(option.value)}
            className="h-8 text-body-xs-regular text-primary"
          >
            <span className="flex min-w-0 items-center gap-2">
              {option.icon}
              <span className="truncate">{option.label}</span>
            </span>
            {selectedValues.has(option.value) && <TickOutline className="size-4 shrink-0" />}
          </MenuRow>
        ))}
        {visible.length === 0 && (
          <p className="px-2 py-2 text-body-xs-regular text-tertiary">{t("common.search.no_matching_results")}</p>
        )}
      </div>
    </div>
  );
}
