import { useMemo } from "react";
import { observer } from "mobx-react";
import {
  MenuCheckboxItem,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
} from "@makeplane/propel/components/menu";
import { CYCLE_STATUS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TCycleGroups } from "@plane/types";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";

type Props = {
  appliedFilters: TCycleGroups[] | null;
  handleUpdate: (value: string) => void;
  searchQuery?: string;
};

export const FilterStatus = observer(function FilterStatus({ appliedFilters, handleUpdate, searchQuery = "" }: Props) {
  const { t } = useTranslation();
  const appliedFiltersSet = useMemo(() => new Set(appliedFilters ?? []), [appliedFilters]);
  const options = CYCLE_STATUS.filter((status) =>
    t(status.i18n_title).toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
  );
  return (
    <MenuSubmenu>
      <MenuSubmenuTrigger
        icon={<FilterFieldIcon field="status" />}
        label={t("web.status")}
        trailing={appliedFilters?.length ? String(appliedFilters.length) : undefined}
      />
      <MenuSubmenuContent>
        {options.map((status) => (
          <MenuCheckboxItem
            key={status.value}
            label={t(status.i18n_title)}
            icon={<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />}
            checked={appliedFiltersSet.has(status.value)}
            onCheckedChange={() => handleUpdate(status.value)}
            closeOnClick={false}
          />
        ))}
        {!options.length && <p className="px-2 py-2 text-12 text-tertiary">{t("web.no_matches_found")}</p>}
      </MenuSubmenuContent>
    </MenuSubmenu>
  );
});
