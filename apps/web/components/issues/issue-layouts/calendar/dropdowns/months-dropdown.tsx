/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import type { IBaseIssueFilterStore } from "@/store/issue/helpers/issue-filter-helper.store";
import { Calendar } from "@makeplane/propel/components/calendar";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { ChevronDownOutline } from "@makeplane/propel/icons";
import { getCalendarLocale } from "@plane/blocks/property-select";
import { useTranslation } from "@plane/i18n";
import { getCalendarFormatters, getDate, getDateTimeFormatter } from "@plane/utils";
import { useCalendarView } from "@/hooks/store/use-calendar-view";

interface Props {
  issuesFilterStore: Pick<IBaseIssueFilterStore, "issueFilters">;
}
export const CalendarMonthsDropdown = observer(function CalendarMonthsDropdown({ issuesFilterStore }: Props) {
  const { currentLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const issueCalendarView = useCalendarView();
  const calendarLayout = issuesFilterStore.issueFilters?.displayFilters?.calendar?.layout ?? "month";
  const { activeMonthDate, activeWeekDate } = issueCalendarView.calendarFilters;
  const formatter = getDateTimeFormatter({ month: "long", year: "numeric" });
  let label = formatter.format(activeMonthDate);
  if (calendarLayout === "week") {
    const days = Object.keys(issueCalendarView.allDaysOfActiveWeek ?? {});
    const first = getDate(days[0]) ?? activeWeekDate;
    const last = getDate(days[days.length - 1]) ?? first;
    label = formatter.formatRange(first, last);
  }
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        disabled={calendarLayout === "week"}
        render={
          <Button
            variant="ghost"
            size="md"
            stretch="auto"
            label={label}
            icon={<Icon icon={ChevronDownOutline} />}
            iconPosition="end"
          />
        }
      />
      <PopoverContent variant="rich" side="bottom" align="start" collisionPadding={12} data-date-picker="">
        <PopoverBody>
          <Calendar
            {...getCalendarLocale(currentLocale)}
            formatters={getCalendarFormatters()}
            defaultView="months"
            defaultMonth={activeMonthDate}
            onMonthChange={(date) => {
              issueCalendarView.updateCalendarFilters({
                activeMonthDate: new Date(date.getFullYear(), date.getMonth(), 1),
              });
              setIsOpen(false);
            }}
          />
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
});
