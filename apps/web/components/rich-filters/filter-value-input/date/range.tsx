/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Button } from "@makeplane/propel/components/button";
import { Calendar } from "@makeplane/propel/components/calendar";
import { useTranslation } from "@plane/i18n";
import { MenuPanel } from "@plane/blocks/select";
import type { TDateRangeFilterFieldConfig, TFilterConditionNodeForDisplay, TFilterProperty } from "@plane/types";
import {
  cn,
  formatCompactDateRange,
  getCalendarFormatters,
  isValidDate,
  renderFormattedPayloadDate,
  toFilterArray,
} from "@plane/utils";
// hooks
import { useUserProfile } from "@/hooks/store/user";
// local imports
import { COMMON_FILTER_ITEM_BORDER_CLASSNAME, EMPTY_FILTER_PLACEHOLDER_TEXT } from "../../shared";

type TDateRangeFilterValueInputProps<P extends TFilterProperty> = {
  config: TDateRangeFilterFieldConfig<string>;
  condition: TFilterConditionNodeForDisplay<P, string>;
  isDisabled?: boolean;
  onChange: (value: string[]) => void;
};

const addDays = (offset: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
};

export const DateRangeFilterValueInput = observer(function DateRangeFilterValueInput<P extends TFilterProperty>(
  props: TDateRangeFilterValueInputProps<P>
) {
  const { config, condition, isDisabled, onChange } = props;
  const { t } = useTranslation();
  const { data: userProfile } = useUserProfile();
  const [fromRaw, toRaw] = toFilterArray(condition.value) ?? [];
  const from = isValidDate(fromRaw) ? new Date(fromRaw) : undefined;
  const to = isValidDate(toRaw) ? new Date(toRaw) : undefined;
  const isIncomplete = !from || !to;
  const [open, setOpen] = useState(isIncomplete);
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({ from, to });

  const applyRange = (start: Date | undefined, end: Date | undefined, closeAfter = false) => {
    setDraftRange({ from: start, to: end });
    const formattedFrom = start ? renderFormattedPayloadDate(start) : undefined;
    const formattedTo = end ? renderFormattedPayloadDate(end) : undefined;
    if (formattedFrom && formattedTo) {
      onChange([formattedFrom, formattedTo]);
      if (closeAfter) setOpen(false);
    } else if (!start && !end) {
      onChange([]);
      if (closeAfter) setOpen(false);
    }
  };

  const disabledDates = [
    ...(config.min ? [{ before: config.min }] : []),
    ...(config.max ? [{ after: config.max }] : []),
  ];

  const triggerLabel = from && to ? formatCompactDateRange({ from, to }) : EMPTY_FILTER_PLACEHOLDER_TEXT;

  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraftRange({ from, to });
      }}
    >
      <BasePopover.Trigger
        disabled={isDisabled}
        className={cn(
          "flex h-full cursor-pointer items-center px-2 text-body-xs-regular outline-none hover:bg-layer-transparent-hover disabled:cursor-not-allowed",
          {
            [COMMON_FILTER_ITEM_BORDER_CLASSNAME]: !isDisabled,
            "text-danger-primary": isIncomplete,
            "text-primary": !isIncomplete,
          }
        )}
      >
        <span className="truncate">{triggerLabel}</span>
      </BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="start" sideOffset={4} collisionPadding={16} className="z-60">
          <BasePopover.Popup render={<MenuPanel flush className="w-auto overflow-hidden p-2" />}>
            <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-subtle pb-2">
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("common.today")}
                onClick={() => applyRange(addDays(0), addDays(0), true)}
              />
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("common.1_week_from_now")}
                onClick={() => applyRange(addDays(0), addDays(7), true)}
              />
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("common.2_weeks_from_now")}
                onClick={() => applyRange(addDays(0), addDays(14), true)}
              />
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("common.1_month_from_now")}
                onClick={() => applyRange(addDays(0), addDays(30), true)}
              />
              {!isIncomplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  stretch="auto"
                  label={t("common.clear")}
                  onClick={() => applyRange(undefined, undefined, true)}
                />
              )}
            </div>
            <Calendar
              mode="range"
              selected={draftRange.from ? { from: draftRange.from, to: draftRange.to } : undefined}
              defaultMonth={draftRange.from ?? from}
              onSelect={(range) => {
                if (!range) {
                  applyRange(undefined, undefined, false);
                  return;
                }
                const complete = Boolean(range.from && range.to && range.from.getTime() !== range.to.getTime());
                applyRange(range.from, range.to, complete);
              }}
              formatters={getCalendarFormatters()}
              weekStartsOn={userProfile?.start_of_the_week}
              disabled={disabledDates.length > 0 ? disabledDates : undefined}
              showOutsideDays
            />
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
});
