/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { getCalendarLocale } from "./calendar-locale";
import { useTranslation } from "@plane/i18n";
import { Calendar } from "@makeplane/propel/components/calendar";
import {
  formatLocalizedDate,
  formatLocalizedDateRange,
  getCalendarFormatters,
  isEnglishDateLocale,
} from "@plane/utils";
import type { DateSelectCommonProps } from "./date-select-shell";
import { DateSelectShell } from "./date-select-shell";
import { buildDisabledMatchers, DEFAULT_DATE_FORMAT_TOKEN } from "./date-select.utils";

/** Both ends of the picked range. Either end may be unset. */
export type DateRangeValue = {
  from: Date | null;
  to: Date | null;
};

export type DateRangeSelectProps = DateSelectCommonProps & {
  value: DateRangeValue;
  /**
   * Emits the completed range — both ends at once, on the second click. The first click only opens
   * the range (it is held internally and shown in the calendar, but not emitted), so a caller never
   * has to persist a half-picked range. A one-day range comes through as `from === to`. Clearing
   * emits `{ from: null, to: null }`.
   */
  onChange: (range: DateRangeValue) => void;
  /**
   * Collapses the trigger label to the shared parts of the two dates — "Jun 10 - 24, 2025" for a
   * range inside one month, "Jan 24 - Feb 02, 2025" inside one year — instead of repeating the
   * whole date twice. Honoured for the four `formatToken` values Plane ships (`MMM dd, yyyy`,
   * `dd/MM/yyyy`, `MM/dd/yyyy`, `yyyy/MM/dd` — see `MERGE_TOKENS`); any other token keeps the whole
   * label on both ends. Ignored when {@link formatLabel} is given. @default false
   */
  mergeDates?: boolean;
  /**
   * Full control of the trigger label. Receives the committed range and both ends already formatted
   * with `formatToken`; return the string the trigger should show. Wins over {@link mergeDates}.
   */
  formatLabel?: (range: DateRangeValue, formatted: { from: string; to: string }) => string;
};

/** The tokens each end is formatted with, for one of the two merge cases. */
type MergeTokenPair = { from: string; to: string };

/**
 * How the merged label is built, per date format Plane ships (`TDateAttributeDisplayOptions` in
 * `packages/types/src/work-item-types/work-item-property-configurations.ts`). The parts the two
 * dates share are printed once, at whichever end of the token they sit:
 *
 * | `formatToken`  | same year, other month  | same month            |
 * | -------------- | ----------------------- | --------------------- |
 * | `MMM dd, yyyy` | `Jan 24 - Feb 02, 2025` | `Jun 10 - 24, 2025`   |
 * | `dd/MM/yyyy`   | `24/01 - 02/02/2025`    | `10 - 24/06/2025`     |
 * | `MM/dd/yyyy`   | `01/24 - 02/02/2025`    | `06/10 - 24/2025`     |
 * | `yyyy/MM/dd`   | `2025/01/24 - 02/02`    | `2025/06/10 - 24`     |
 *
 * Hand-written per token rather than derived by trimming segments off the caller's own token:
 * a regex that strips `y+` or `M+` with its separator leaves dangling and doubled slashes in every
 * token but the first ("dd/MM/yyyy" became "10/06/ - 24//2025"). An unlisted token keeps the whole
 * label on both ends.
 */
const MERGE_TOKENS: Record<string, { sameYear: MergeTokenPair; sameMonth: MergeTokenPair }> = {
  "MMM dd, yyyy": { sameYear: { from: "MMM dd", to: "MMM dd, yyyy" }, sameMonth: { from: "MMM dd", to: "dd, yyyy" } },
  "dd/MM/yyyy": { sameYear: { from: "dd/MM", to: "dd/MM/yyyy" }, sameMonth: { from: "dd", to: "dd/MM/yyyy" } },
  "MM/dd/yyyy": { sameYear: { from: "MM/dd", to: "MM/dd/yyyy" }, sameMonth: { from: "MM/dd", to: "dd/yyyy" } },
  "yyyy/MM/dd": { sameYear: { from: "yyyy/MM/dd", to: "MM/dd" }, sameMonth: { from: "yyyy/MM/dd", to: "dd" } },
};

/** Both ends of a range, formatted for the trigger. An unset end is an empty string. */
type FormattedRangeEnds = { from: string; to: string };

/** Formats `from` and `to` with the trigger's token; an unset end is an empty string. */
function formatRangeEnds(value: DateRangeValue, formatToken: string): FormattedRangeEnds {
  return {
    from: value.from ? formatLocalizedDate(value.from, formatToken) : "",
    to: value.to ? formatLocalizedDate(value.to, formatToken) : "",
  };
}

/** Both formatted ends as one label, tolerating a missing (or empty) end. */
function joinRangeEnds(from: string, to: string): string {
  return from && to ? `${from} - ${to}` : from || to;
}

/**
 * The merged label: drop from one end whatever the other repeats. Two days in one month give
 * "Jun 10 - 24, 2025"; two months in one year give "Jan 24 - Feb 02, 2025"; anything wider — or any
 * `formatToken` outside {@link MERGE_TOKENS} — stays whole.
 */
function mergeRangeLabel(range: DateRangeValue, from: string, to: string, formatToken: string): string {
  const joined = joinRangeEnds(from, to);
  if (!range.from || !range.to || !from || !to) return joined;
  if (range.from.getFullYear() !== range.to.getFullYear()) return joined;
  // Non-English languages: `Intl` merges the shared parts in the locale's own order
  if (!isEnglishDateLocale()) {
    const localized = formatLocalizedDateRange(range.from, range.to, formatToken);
    if (localized) return localized;
  }
  const tokens = MERGE_TOKENS[formatToken];
  if (!tokens) return joined;
  const pair = range.from.getMonth() === range.to.getMonth() ? tokens.sameMonth : tokens.sameYear;
  return `${formatLocalizedDate(range.from, pair.from)} - ${formatLocalizedDate(range.to, pair.to)}`;
}

type TriggerLabelParams = {
  value: DateRangeValue;
  formatToken: string;
  ends: FormattedRangeEnds;
  joined: string;
  formatLabel?: DateRangeSelectProps["formatLabel"];
  mergeDates?: boolean;
};

/**
 * The trigger label: the caller's formatter wins, then the merged label, then both ends joined.
 * An empty formatter result is kept — the caller may fall back to the placeholder itself.
 */
function getTriggerLabel(params: TriggerLabelParams): string {
  if (params.formatLabel) return params.formatLabel(params.value, params.ends);
  if (params.mergeDates) return mergeRangeLabel(params.value, params.ends.from, params.ends.to, params.formatToken);
  return params.joined;
}

/** Nothing picked at either end. */
function isRangeEmpty(range: DateRangeValue): boolean {
  return !range.from && !range.to;
}

/** react-day-picker's `selected` for the calendar: no start means no selection at all. */
function getCalendarSelection(range: DateRangeValue): { from: Date; to?: Date } | undefined {
  if (!range.from) return undefined;
  return { from: range.from, to: range.to ?? undefined };
}

/** A range as react-day-picker hands it back; either end may be unset. */
type PickedRange = { from?: Date; to?: Date } | undefined;

type RangeClickHandlers = {
  setDraft: (range: DateRangeValue | null) => void;
  onChange: (range: DateRangeValue) => void;
  close: () => void;
};

/**
 * A calendar click either restarts the range (the open end was deselected), commits the second
 * end, or — on the first click — holds it as the draft shown in the calendar but not emitted.
 */
function handleRangeClick(range: PickedRange, hasDraft: boolean, handlers: RangeClickHandlers): void {
  const next = { from: range?.from ?? null, to: range?.to ?? null };
  if (!next.from) {
    handlers.setDraft(null);
    return;
  }
  if (!hasDraft) {
    handlers.setDraft({ from: next.from, to: null });
    return;
  }
  handlers.onChange(next);
  handlers.close();
}

type OpenChangeHandlers = {
  setIsOpen: (open: boolean) => void;
  setDraft: (range: DateRangeValue | null) => void;
  onClose?: () => void;
};

/** Opening resets the draft; closing also notifies the caller. */
function applyOpenChange(open: boolean, handlers: OpenChangeHandlers): void {
  handlers.setIsOpen(open);
  handlers.setDraft(null);
  if (!open) handlers.onClose?.();
}

/**
 * Presentational, data-source-agnostic range picker: the `Select` trigger chrome over a propel
 * `Calendar` in range mode. Propel's `Calendar` drops react-day-picker's `numberOfMonths` (its
 * styled contract covers one month), so the panel shows a single month and the user pages through
 * it — the two-month side-by-side layout needs the upstream prop before it can come back.
 */
export function DateRangeSelect(props: DateRangeSelectProps) {
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
  // react-day-picker answers the FIRST click of a range with `{ from: day, to: day }`, which is
  // indistinguishable from a finished one-day range. The half-picked range is held here — shown in
  // the calendar, withheld from `onChange` — until the second click completes it, so a caller never
  // sees a range it did not ask for.
  const [draft, setDraft] = useState<DateRangeValue | null>(null);
  // derived values
  const ends = formatRangeEnds(value, formatToken);
  const joined = joinRangeEnds(ends.from, ends.to);
  const formatted = getTriggerLabel({
    value,
    formatToken,
    ends,
    joined,
    formatLabel: props.formatLabel,
    mergeDates: props.mergeDates,
  });
  const isEmpty = isRangeEmpty(value);
  const disabledMatchers = buildDisabledMatchers(minDate, maxDate);
  // The calendar shows the in-progress pick; the trigger keeps showing the committed value.
  const shown = draft ?? value;
  const selected = getCalendarSelection(shown);

  const handleOpenChange = (open: boolean) => applyOpenChange(open, { setIsOpen, setDraft, onClose });

  return (
    <DateSelectShell
      {...props}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      label={formatted || placeholder}
      isEmpty={isEmpty}
      tooltipContent={props.tooltipContent ?? joined}
      canClear={clearable && !isEmpty}
      onClear={() => {
        onChange({ from: null, to: null });
        handleOpenChange(false);
      }}
    >
      <Calendar
        {...getCalendarLocale(currentLocale)}
        formatters={getCalendarFormatters()}
        mode="range"
        selected={selected}
        defaultMonth={value.from ?? defaultMonth}
        disabled={disabledMatchers}
        weekStartsOn={weekStartsOn}
        onSelect={(range) =>
          handleRangeClick(range, draft !== null, {
            setDraft,
            onChange,
            close: () => handleOpenChange(false),
          })
        }
      />
    </DateSelectShell>
  );
}

DateRangeSelect.displayName = "blocks.DateRangeSelect";
