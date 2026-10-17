import { observer } from "mobx-react";
import { CYCLE_STATUS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { ProjectFilterChip } from "@/components/project/applied-filters/chip";

type Props = {
  handleRemove: (value: string) => void;
  values: string[];
  editable: boolean | undefined;
};

export const AppliedStatusFilters = observer(function AppliedStatusFilters({ handleRemove, values, editable }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {values.map((status) => {
        const details = CYCLE_STATUS.find((option) => option.value === status);
        return (
          <ProjectFilterChip
            key={status}
            label={details ? t(details.i18n_title) : status}
            icon={
              details && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: details.color }} />
            }
            onRemove={editable ? () => handleRemove(status) : undefined}
          />
        );
      })}
    </>
  );
});
