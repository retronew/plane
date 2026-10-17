import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CloseOutline } from "@makeplane/propel/icons";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TCycleFilters } from "@plane/types";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";
import { useUserPermissions } from "@/hooks/store/user";
import { AppliedDateFilters } from "./date";
import { AppliedStatusFilters } from "./status";

type Props = {
  appliedFilters: TCycleFilters;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (key: keyof TCycleFilters, value: string | null) => void;
  alwaysAllowEditing?: boolean;
};

const FILTER_LABELS: Record<keyof TCycleFilters, string> = {
  status: "web.status",
  start_date: "web.start_date",
  end_date: "project_cycles.end_date",
};

export const CycleAppliedFiltersList = observer(function CycleAppliedFiltersList({
  appliedFilters,
  handleClearAllFilters,
  handleRemoveFilter,
  alwaysAllowEditing,
}: Props) {
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();
  if (!appliedFilters || Object.values(appliedFilters).every((values) => !values?.length)) return null;

  const isEditingAllowed =
    alwaysAllowEditing ||
    allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);

  return (
    <div className="flex flex-wrap items-center gap-2 bg-surface-1">
      {(Object.keys(FILTER_LABELS) as (keyof TCycleFilters)[]).map((key) => {
        const values = appliedFilters[key];
        if (!values?.length) return null;
        return (
          <div
            key={key}
            className="my-auto flex min-h-7 flex-wrap items-center gap-1.5 rounded-md border border-subtle-1 bg-layer-2 px-2 py-0.5 text-11 text-tertiary"
          >
            <FilterFieldIcon field={key} />
            <span>{t(FILTER_LABELS[key])}</span>
            <div className="flex flex-wrap items-center gap-1">
              {key === "status" ? (
                <AppliedStatusFilters
                  editable={isEditingAllowed}
                  handleRemove={(value) => handleRemoveFilter(key, value)}
                  values={values}
                />
              ) : (
                <AppliedDateFilters
                  editable={isEditingAllowed}
                  handleRemove={(value) => handleRemoveFilter(key, value)}
                  values={values}
                />
              )}
              {isEditingAllowed && (
                <IconButton
                  variant="ghost"
                  size="xs"
                  icon={<CloseOutline />}
                  aria-label={`${t("remove")} ${t(FILTER_LABELS[key])}`}
                  onClick={() => handleRemoveFilter(key, null)}
                />
              )}
            </div>
          </div>
        );
      })}
      {isEditingAllowed && (
        <Button
          variant="secondary"
          size="md"
          stretch="auto"
          label={t("common.clear_all")}
          onClick={handleClearAllFilters}
        />
      )}
    </div>
  );
});
