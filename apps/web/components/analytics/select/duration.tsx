/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// react
import React from "react";
import { CalendarDays } from "lucide-react";
// plane package imports
import { ANALYTICS_DURATION_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Select } from "@plane/blocks/select";

type TDurationOption = (typeof ANALYTICS_DURATION_FILTER_OPTIONS)[number];

type Props = {
  value: string | null;
  onChange: (val: TDurationOption["value"]) => void;
  placeholder?: string;
};

const getDurationOption = (value: string | null) =>
  ANALYTICS_DURATION_FILTER_OPTIONS.find((option) => option.value === value) ?? null;

function DurationDropdown({ placeholder: placeholderProp, onChange, value }: Props) {
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t("workspace_analytics.dashboard.all_time");

  // derived values
  const selectedOption = value === "all_time" ? null : getDurationOption(value);

  return (
    <Select<TDurationOption>
      placeholder={placeholder}
      getValues={() => [...ANALYTICS_DURATION_FILTER_OPTIONS]}
      value={selectedOption}
      onChange={(val) => {
        const option = getDurationOption(val);
        if (option) onChange(option.value);
      }}
      getOptionValue={(option) => option.value}
      getOptionLabel={(option) => option.name}
      pinSelected={false}
    >
      <Select.Trigger<TDurationOption>
        className="w-auto"
        variant="select-md"
        prependIcon={<CalendarDays className="size-3.5" aria-hidden="true" />}
      >
        {(selected) => <span className="truncate">{selected[0]?.name ?? placeholder}</span>}
      </Select.Trigger>
    </Select>
  );
}

export default DurationDropdown;
