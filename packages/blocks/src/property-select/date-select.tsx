/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { getCalendarLocale } from "./calendar-locale";
import { useTranslation } from "@plane/i18n";
import { Calendar } from "@makeplane/propel/components/calendar";
import { formatLocalizedDate, getCalendarFormatters } from "@plane/utils";
import type { DateSelectCommonProps } from "./date-select-shell";
import { DateSelectShell } from "./date-select-shell";
import { buildDisabledMatchers, DEFAULT_DATE_FORMAT_TOKEN } from "./date-select.utils";

export type DateSelectProps = DateSelectCommonProps & {
  /** The picked day, or `null` when nothing is set. */
  value: Date | null;
  /** Emits the newly picked day, or `null` when cleared. */
  onChange: (date: Date | null) => void;
  /** Customize the trigger label while preserving the full formatted date in its tooltip. */
  formatLabel?: (date: Date, formatted: string) => string;
};

/**
 * Presentational, data-source-agnostic single-day picker: the `Select` trigger chrome over a propel
 * `Calendar` in a popover. The client owns the value and supplies the user's `weekStartsOn` and
 * `formatToken` — this block owns only the picker.
 */
export function DateSelect(props: DateSelectProps) {
  const {
    value,
    onChange,
    formatToken = DEFAULT_DATE_FORMAT_TOKEN,
    minDate,
    maxDate,
    weekStartsOn,
    defaultMonth,
    placeholder = "",
    clearable = false,
    onClose,
  } = props;
  const { currentLocale } = useTranslation();
  // states
  const [isOpen, setIsOpen] = useState(props.defaultOpen ?? false);
  // derived values
  const formatted = value ? formatLocalizedDate(value, formatToken) : "";
  const disabledMatchers = buildDisabledMatchers(minDate, maxDate);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) onClose?.();
  };

  return (
    <DateSelectShell
      {...props}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      label={value && props.formatLabel ? props.formatLabel(value, formatted) : formatted || placeholder}
      isEmpty={!value}
      tooltipContent={props.tooltipContent ?? formatted}
      canClear={clearable && value !== null}
      onClear={() => {
        onChange(null);
        handleOpenChange(false);
      }}
    >
      <Calendar
        {...getCalendarLocale(currentLocale)}
        formatters={getCalendarFormatters()}
        mode="single"
        selected={value ?? undefined}
        defaultMonth={value ?? defaultMonth}
        disabled={disabledMatchers}
        weekStartsOn={weekStartsOn}
        onSelect={(date) => {
          // A repeat click on the selected day deselects it in react-day-picker; treat that as a
          // clear only when the caller allows one, otherwise keep the current value.
          if (!date && !clearable) return;
          onChange(date ?? null);
          handleOpenChange(false);
        }}
      />
    </DateSelectShell>
  );
}

DateSelect.displayName = "blocks.DateSelect";
