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
import type { TDateFilterFieldConfig, TFilterConditionNodeForDisplay, TFilterProperty } from "@plane/types";
import { cn, getCalendarFormatters, getDate, renderFormattedDate, renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { useUserProfile } from "@/hooks/store/user";
// local imports
import { COMMON_FILTER_ITEM_BORDER_CLASSNAME, EMPTY_FILTER_PLACEHOLDER_TEXT } from "../../shared";

type TSingleDateFilterValueInputProps<P extends TFilterProperty> = {
  config: TDateFilterFieldConfig<string>;
  condition: TFilterConditionNodeForDisplay<P, string>;
  isDisabled?: boolean;
  onChange: (value: string | null | undefined) => void;
};

const addDays = (offset: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
};

export const SingleDateFilterValueInput = observer(function SingleDateFilterValueInput<P extends TFilterProperty>(
  props: TSingleDateFilterValueInputProps<P>
) {
  const { config, condition, isDisabled, onChange } = props;
  const { t } = useTranslation();
  const { data: userProfile } = useUserProfile();
  const conditionValue = typeof condition.value === "string" ? condition.value : null;
  const selectedDate = getDate(conditionValue) ?? undefined;
  const [open, setOpen] = useState(!conditionValue);

  const applyDate = (date: Date | null) => {
    const formatted = date ? renderFormattedPayloadDate(date) : null;
    onChange(formatted);
    setOpen(false);
  };

  const disabledDates = [
    ...(config.min ? [{ before: config.min }] : []),
    ...(config.max ? [{ after: config.max }] : []),
  ];

  return (
    <BasePopover.Root open={open} onOpenChange={setOpen}>
      <BasePopover.Trigger
        disabled={isDisabled}
        className={cn(
          "flex h-full cursor-pointer items-center px-2 text-body-xs-regular outline-none hover:bg-layer-transparent-hover disabled:cursor-not-allowed",
          {
            [COMMON_FILTER_ITEM_BORDER_CLASSNAME]: !isDisabled,
            "text-placeholder": !conditionValue,
            "text-primary": !!conditionValue,
          }
        )}
      >
        <span className="truncate">
          {conditionValue ? renderFormattedDate(conditionValue) : EMPTY_FILTER_PLACEHOLDER_TEXT}
        </span>
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
                onClick={() => applyDate(addDays(0))}
              />
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("common.1_week_from_now")}
                onClick={() => applyDate(addDays(7))}
              />
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("common.2_weeks_from_now")}
                onClick={() => applyDate(addDays(14))}
              />
              {conditionValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  stretch="auto"
                  label={t("common.clear")}
                  onClick={() => applyDate(null)}
                />
              )}
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              onSelect={(date: Date | undefined) => {
                if (date) applyDate(date);
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
