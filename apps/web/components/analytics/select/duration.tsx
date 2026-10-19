/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
// oxlint-disable-next-line import/no-unassigned-import -- Styles target the popup rendered in a portal.
import "./duration.css";
import { useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { format } from "date-fns";
import { ANALYTICS_DURATION_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { SelectTriggerChrome } from "@plane/blocks/select";
import { DateRangeSelect } from "@plane/blocks/property-select";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { formatLocalizedDateRange } from "@plane/utils";
import { parseCustomAnalyticsRange } from "./duration-range";

type Props = { value: string | null; onChange: (value: string) => void; placeholder?: string };
export default function DurationDropdown({ value, onChange, placeholder: placeholderProp }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const custom = parseCustomAnalyticsRange(value);
  const placeholder = placeholderProp ?? t("workspace_analytics.dashboard.all_time");
  const label = custom
    ? (formatLocalizedDateRange(custom.from, custom.to, "yyyy/MM/dd") ??
      `${format(custom.from, "yyyy/MM/dd")} – ${format(custom.to, "yyyy/MM/dd")}`)
    : (ANALYTICS_DURATION_FILTER_OPTIONS.find((option) => option.value === value)?.name ?? placeholder);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <SelectTriggerChrome
            variant="select-md"
            className="w-auto max-w-full"
            isActive={open}
            isEmpty={!value || value === "all_time"}
            aria-label={label}
            prependIcon={<CalendarDays className="size-3.5" aria-hidden="true" />}
          >
            <span className="truncate">{label}</span>
          </SelectTriggerChrome>
        }
      />
      <PopoverContent align="end" data-analytics-duration="">
        <PopoverBody>
          <div className="w-full">
            <fieldset aria-label={t("workspace_analytics.dashboard.all_time")} className="flex flex-col">
              {ANALYTICS_DURATION_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={value === option.value}
                  className="flex h-7 items-center justify-between gap-3 rounded-md px-2 text-left text-13 text-secondary hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:outline-accent-strong"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.name}
                  {value === option.value && <Check className="size-3.5" aria-hidden="true" />}
                </button>
              ))}
            </fieldset>
            <div className="mt-1 border-t border-subtle pt-1">
              <DateRangeSelect
                value={custom ?? { from: null, to: null }}
                variant="select-ghost-md"
                className="w-full max-w-none"
                placeholder={t("workspace_analytics.dashboard.custom_range")}
                formatToken="yyyy/MM/dd"
                mergeDates
                onChange={({ from, to }) => {
                  if (!from || !to) return;
                  onChange(`custom:${format(from, "yyyy-MM-dd")}:${format(to, "yyyy-MM-dd")}`);
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
