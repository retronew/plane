import { observer } from "mobx-react";
import type { TCycleFilters, TCycleGroups } from "@plane/types";
import { FilterEndDate } from "./end-date";
import { FilterStartDate } from "./start-date";
import { FilterStatus } from "./status";

type Props = {
  filters: TCycleFilters;
  handleFiltersUpdate: (key: keyof TCycleFilters, value: string | string[]) => void;
  isArchived?: boolean;
};

export const CycleFiltersSelection = observer(function CycleFiltersSelection({
  filters,
  handleFiltersUpdate,
  isArchived = false,
}: Props) {
  return (
    <div className="w-48 max-w-[calc(100vw-32px)]">
      {!isArchived && (
        <FilterStatus
          appliedFilters={(filters.status as TCycleGroups[]) ?? null}
          handleUpdate={(value) => handleFiltersUpdate("status", value)}
        />
      )}
      <FilterStartDate
        appliedFilters={filters.start_date ?? null}
        handleUpdate={(value) => handleFiltersUpdate("start_date", value)}
      />
      <FilterEndDate
        appliedFilters={filters.end_date ?? null}
        handleUpdate={(value) => handleFiltersUpdate("end_date", value)}
      />
    </div>
  );
});
