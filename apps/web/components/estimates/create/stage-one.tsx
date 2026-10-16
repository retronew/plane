/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { ESTIMATE_SYSTEMS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import type { TEstimateSystemKeys } from "@plane/types";
import { isEstimateSystemEnabled } from "./helper";
import { RadioInput } from "../radio-select";

type Props = {
  estimateSystem: TEstimateSystemKeys;
  handleEstimateSystem: (value: TEstimateSystemKeys) => void;
  templateKey: string;
  handleTemplateChange: (value: string) => void;
  disabled?: boolean;
};

export function EstimateCreateStageOne({
  estimateSystem,
  handleEstimateSystem,
  templateKey,
  handleTemplateChange,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const options = Object.entries(ESTIMATE_SYSTEMS[estimateSystem].templates)
    .filter(([, template]) => !template.hide)
    .map(([value, template]) => ({
      value,
      label: `${t(template.i18n_title)} (${template.values.map((point) => point.value).join(", ")})`,
      description: t(`project_settings.estimates.create.template_help.${value}`),
    }));
  return (
    <div className="space-y-4">
      <RadioInput
        options={Object.keys(ESTIMATE_SYSTEMS)
          .filter((key) => isEstimateSystemEnabled(key as TEstimateSystemKeys))
          .map((key) => ({ label: t(ESTIMATE_SYSTEMS[key as TEstimateSystemKeys].i18n_name), value: key }))}
        disabled={disabled}
        name="estimate-radio-input"
        label={t("project_settings.estimates.create.choose_estimate_system")}
        labelClassName="text-13 font-medium text-secondary mb-2"
        wrapperClassName="relative flex flex-wrap gap-x-6 gap-y-2"
        fieldClassName="relative flex items-center gap-1.5"
        buttonClassName="size-4"
        selected={estimateSystem}
        onChange={(value) => handleEstimateSystem(value as TEstimateSystemKeys)}
      />
      <div className="space-y-2">
        <p id="estimate-template-label" className="text-13 font-medium text-secondary">
          {t("project_settings.estimates.create.choose_template")}
        </p>
        <div className="[&_button]:w-full [&_button]:min-w-0">
          <Select<string>
            value={templateKey}
            disabled={disabled}
            items={options}
            onValueChange={(value) => {
              if (value) handleTemplateChange(value);
            }}
          >
            <SelectTrigger
              aria-labelledby="estimate-template-label"
              size="lg"
              width="fit"
              placeholder={t("project_settings.estimates.create.choose_template")}
            />
            <SelectContent sizing="anchor-fixed">
              <SelectList>
                {options.map((option) => (
                  <SelectItem key={option.value} {...option} />
                ))}
              </SelectList>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
