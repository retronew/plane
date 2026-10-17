import { observer } from "mobx-react";
import { CalendarOutline } from "@makeplane/propel/icons";
import { DATE_AFTER_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { isInDateFormat, renderFormattedDate } from "@plane/utils";
import { ProjectFilterChip } from "@/components/project/applied-filters/chip";

type Props = {
  editable: boolean | undefined;
  handleRemove: (value: string) => void;
  values: string[];
};

export const AppliedDateFilters = observer(function AppliedDateFilters({ editable, handleRemove, values }: Props) {
  const { t } = useTranslation();
  const getDateLabel = (value: string) => {
    const preset = DATE_AFTER_FILTER_OPTIONS.find((option) => option.value === value);
    if (preset) return preset.name;
    const [date, direction] = value.split(";");
    if (isInDateFormat(date) && (direction === "before" || direction === "after"))
      return `${t(direction === "before" ? "web.before" : "web.after")} ${renderFormattedDate(date)}`;
    return value;
  };
  return (
    <>
      {values.map((date) => (
        <ProjectFilterChip
          key={date}
          label={getDateLabel(date)}
          icon={<CalendarOutline className="size-3" />}
          onRemove={editable ? () => handleRemove(date) : undefined}
        />
      ))}
    </>
  );
});
