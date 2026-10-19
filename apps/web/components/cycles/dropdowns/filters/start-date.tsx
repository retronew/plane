import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import { Calendar } from "@makeplane/propel/components/calendar";
import {
  MenuCheckboxItem,
  MenuSubmenu,
  MenuSubmenuContent,
  MenuSubmenuTrigger,
} from "@makeplane/propel/components/menu";
import { getCalendarLocale } from "@plane/blocks/property-select";
import { DATE_AFTER_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { getCalendarFormatters, getDate, isInDateFormat, renderFormattedPayloadDate } from "@plane/utils";
import { FilterFieldIcon } from "@/components/common/filters/field-icon";

type CycleDateFilterProps = {
  appliedFilters: string[] | null;
  handleUpdate: (value: string | string[]) => void;
  searchQuery?: string;
};

type DateCondition = "before" | "after" | "range";

function CustomDateMenu({
  values,
  handleUpdate,
}: {
  values: string[];
  handleUpdate: CycleDateFilterProps["handleUpdate"];
}) {
  const { t, currentLocale } = useTranslation();
  const before = values.find((value) => value.endsWith(";before"))?.split(";")[0];
  const after = values.find((value) => value.endsWith(";after"))?.split(";")[0];
  const [condition, setCondition] = useState<DateCondition>(
    before && after ? "range" : before ? "before" : after ? "after" : "range"
  );
  const [from, setFrom] = useState<Date | undefined>(() => getDate(after ?? before ?? "") ?? undefined);
  const [to, setTo] = useState<Date | undefined>(() => getDate(before ?? "") ?? undefined);
  const [open, setOpen] = useState(false);
  const complete = !!from && (condition !== "range" || (!!to && from <= to));
  const apply = () => {
    if (!from || !complete) return;
    const next =
      condition === "range" && to
        ? [`${renderFormattedPayloadDate(from)};after`, `${renderFormattedPayloadDate(to)};before`]
        : [`${renderFormattedPayloadDate(from)};${condition}`];
    // The caller toggles each value, so only emit the symmetric difference when editing a range.
    const previousSet = new Set(values);
    const nextSet = new Set(next);
    const changes = [
      ...values.filter((value) => !nextSet.has(value)),
      ...next.filter((value) => !previousSet.has(value)),
    ];
    if (changes.length) handleUpdate(changes);
    setOpen(false);
  };
  return (
    <MenuSubmenu open={open} onOpenChange={setOpen}>
      <MenuSubmenuTrigger label={t("web.custom")} trailing={values.length ? String(values.length) : undefined} />
      <MenuSubmenuContent>
        <div className="max-w-[calc(100vw-32px)] space-y-2 p-2">
          <fieldset className="flex gap-1" aria-label={t("date_range")}>
            {(["before", "after", "range"] as const).map((value) => (
              <Button
                key={value}
                variant={condition === value ? "primary" : "secondary"}
                size="sm"
                stretch="auto"
                aria-pressed={condition === value}
                label={t(value === "range" ? "date_range" : value === "before" ? "web.before" : "web.after")}
                onClick={() => {
                  setCondition(value);
                  setFrom(undefined);
                  setTo(undefined);
                }}
              />
            ))}
          </fieldset>
          {condition === "range" ? (
            <Calendar
              {...getCalendarLocale(currentLocale)}
              formatters={getCalendarFormatters()}
              mode="range"
              selected={from ? { from, to } : undefined}
              defaultMonth={from}
              onSelect={(range) => {
                setFrom(range?.from);
                setTo(range?.to);
              }}
            />
          ) : (
            <Calendar
              {...getCalendarLocale(currentLocale)}
              formatters={getCalendarFormatters()}
              mode="single"
              selected={from}
              defaultMonth={from}
              onSelect={setFrom}
            />
          )}
          <div className="flex justify-end gap-2">
            {values.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("remove")}
                onClick={() => {
                  handleUpdate(values);
                  setFrom(undefined);
                  setTo(undefined);
                  setOpen(false);
                }}
              />
            )}
            <Button
              variant="primary"
              size="sm"
              stretch="auto"
              label={t("web.apply")}
              disabled={!complete}
              onClick={apply}
            />
          </div>
        </div>
      </MenuSubmenuContent>
    </MenuSubmenu>
  );
}

const CycleDateFilterContent = observer(function CycleDateFilterContent({
  field,
  appliedFilters,
  handleUpdate,
  searchQuery = "",
}: CycleDateFilterProps & { field: "start_date" | "end_date" }) {
  const { t } = useTranslation();
  const appliedFiltersSet = useMemo(() => new Set(appliedFilters ?? []), [appliedFilters]);
  const customSelected = (appliedFilters ?? []).filter((value) => isInDateFormat(value.split(";")[0]));
  const filteredOptions = DATE_AFTER_FILTER_OPTIONS.filter((option) =>
    option.name.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
  );

  return (
    <MenuSubmenu>
      <MenuSubmenuTrigger
        icon={<FilterFieldIcon field={field} />}
        label={t(field === "start_date" ? "web.start_date" : "project_cycles.end_date")}
        trailing={appliedFilters?.length ? String(appliedFilters.length) : undefined}
      />
      <MenuSubmenuContent>
        {filteredOptions.map((option) => (
          <MenuCheckboxItem
            key={option.value}
            label={option.name}
            checked={appliedFiltersSet.has(option.value)}
            onCheckedChange={() => handleUpdate(option.value)}
            closeOnClick={false}
          />
        ))}
        <CustomDateMenu key={customSelected.join(",")} values={customSelected} handleUpdate={handleUpdate} />
      </MenuSubmenuContent>
    </MenuSubmenu>
  );
});

export function CycleDateFilter(props: CycleDateFilterProps & { field: "start_date" | "end_date" }) {
  return <CycleDateFilterContent {...props} />;
}

export function FilterStartDate(props: CycleDateFilterProps) {
  return <CycleDateFilter {...props} field="start_date" />;
}
