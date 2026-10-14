/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { add, set } from "date-fns";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@makeplane/propel/components/button";
import {
  DialogActions,
  DialogBody,
  DialogHeader,
  DialogHeading,
  DialogInfo,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { InputField } from "@makeplane/propel/components/input-field";
import { Switch } from "@makeplane/propel/components/switch";
import { TextAreaField } from "@makeplane/propel/components/text-area-field";
import { CalendarOutline } from "@makeplane/propel/icons";
import { DateSelect } from "@plane/blocks/property-select";
import { Select } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation, translate } from "@plane/i18n";
import type { IApiToken } from "@plane/types";
import { renderFormattedDate, renderFormattedTime } from "@plane/utils";
// hooks
import { useUserProfile } from "@/hooks/store/user";
// helpers
type Props = {
  handleClose: () => void;
  onSubmit: (data: Partial<IApiToken>) => Promise<void>;
};

const EXPIRY_DATE_OPTIONS = [
  {
    key: "1_week",
    labelKey: "web.token_expiry_week" as const,
    value: { weeks: 1 },
  },
  {
    key: "1_month",
    labelKey: "web.token_expiry_month" as const,
    value: { months: 1 },
  },
  {
    key: "3_months",
    labelKey: "web.token_expiry_three_months" as const,
    value: { months: 3 },
  },
  {
    key: "1_year",
    labelKey: "web.token_expiry_year" as const,
    value: { years: 1 },
  },
];

/** The expiry picker's rows: the presets plus the "Custom" row that reveals the date picker. */
type TExpiryOption = { key: string; label: string };

const defaultValues: Partial<IApiToken> = {
  label: "",
  description: "",
  expired_at: "1_month",
};

const getExpiryDate = (val: string): Date | null | undefined => {
  const today = new Date();
  const dateToAdd = EXPIRY_DATE_OPTIONS.find((option) => option.key === val)?.value;
  if (dateToAdd) return add(today, dateToAdd);
  return null;
};

const getFormattedDate = (date: Date): Date => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  return set(date, { hours, minutes, seconds, milliseconds: 0 });
};

export function CreateApiTokenForm(props: Props) {
  const { handleClose, onSubmit } = props;
  // states
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  // Earliest selectable custom expiry date, fixed when the form mounts
  const [tomorrow] = useState(() => add(new Date(), { days: 1 }));
  // form
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<IApiToken>({ defaultValues });
  // hooks
  const { t } = useTranslation();
  const expiryOptions: TExpiryOption[] = [
    ...EXPIRY_DATE_OPTIONS.map(({ key, labelKey }) => ({ key, label: t(labelKey) })),
    { key: "custom", label: t("web.custom_date") },
    { key: "never", label: t("web.never_expires") },
  ];
  // store hooks
  const { data: userProfile } = useUserProfile();

  const handleFormSubmit = async (data: IApiToken) => {
    const neverExpires = data.expired_at === "never";
    // if never expires is toggled off, and the user has not selected a custom date or a predefined date, show an error
    if (!neverExpires && (!data.expired_at || (data.expired_at === "custom" && !customDate)))
      return setToast({
        type: "error",
        title: t("toast.error"),
        message: t("web.please_select_an_expiration_date"),
      });

    const payload: Partial<IApiToken> = {
      label: data.label,
      description: data.description,
      scope: readOnly ? "read" : "write",
    };

    // if never expires is toggled on, set expired_at to null
    if (neverExpires) payload.expired_at = null;
    // if never expires is toggled off, and the user has selected a custom date, set expired_at to the custom date
    else if (data.expired_at === "custom") {
      payload.expired_at = customDate && getFormattedDate(customDate).toISOString();
    }
    // if never expires is toggled off, and the user has selected a predefined date, set expired_at to the predefined date
    else {
      const expiryDate = getExpiryDate(data.expired_at ?? "");
      if (expiryDate) payload.expired_at = expiryDate.toISOString();
    }

    await onSubmit(payload).then(() => {
      reset(defaultValues);
      setCustomDate(null);
      setReadOnly(false);
      return undefined;
    });
  };

  const expiredAt = useWatch({ control, name: "expired_at" });
  const neverExpires = expiredAt === "never";
  const expiryDate = getExpiryDate(expiredAt ?? "");
  const customDateFormatted = customDate && getFormattedDate(customDate);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex min-h-0 flex-1 flex-col">
      <DialogMain>
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>{t("workspace_settings.settings.api_tokens.create_token")}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody tabIndex={0}>
          <div className="space-y-3">
            <Controller
              control={control}
              name="label"
              rules={{
                required: t("title_is_required"),
                maxLength: {
                  value: 255,
                  message: t("title_should_be_less_than_255_characters"),
                },
                validate: (val) => val.trim() !== "" || t("title_is_required"),
              }}
              render={({ field: { value, onChange, ref } }) => (
                <InputField
                  type="text"
                  size="lg"
                  orientation="vertical"
                  value={value}
                  onChange={onChange}
                  ref={ref}
                  error={errors.label?.message}
                  placeholder={t("title")}
                  aria-label={t("title")}
                />
              )}
            />
            <Controller
              control={control}
              name="description"
              render={({ field: { value, onChange } }) => (
                <TextAreaField
                  size="lg"
                  resize="none"
                  autoResize
                  maxRows={8}
                  value={value}
                  onChange={onChange}
                  error={errors.description?.message}
                  placeholder={t("description")}
                  aria-label={t("description")}
                />
              )}
            />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Controller
                  control={control}
                  name="expired_at"
                  render={({ field: { onChange, value } }) => {
                    const selectedOption = expiryOptions.find((option) => option.key === value) ?? null;

                    return (
                      <Select<TExpiryOption>
                        getValues={() => expiryOptions}
                        value={selectedOption}
                        onChange={onChange}
                        getOptionValue={(option) => option.key}
                        getOptionLabel={(option) => option.label}
                        showSearch={false}
                        pinSelected={false}
                      >
                        {/* `select-md` rather than the pill chrome the old button matched in height:
                          `SelectTriggerChrome` clamps every pill trigger to `max-w-40`, which clips
                          the longest label here ("Set expiration date"). */}
                        <Select.Trigger variant="select-md" className="w-auto" prependIcon={<CalendarOutline />}>
                          <span className="min-w-0 grow truncate text-left">
                            {value === "custom"
                              ? t("web.custom_date")
                              : (selectedOption?.label ?? t("web.set_expiration_date"))}
                          </span>
                        </Select.Trigger>
                      </Select>
                    );
                  }}
                />
                {expiredAt === "custom" && (
                  <DateSelect
                    value={customDate}
                    onChange={(date) => setCustomDate(date)}
                    minDate={tomorrow}
                    icon={<CalendarOutline />}
                    placeholder={t("web.set_date")}
                    clearable
                    weekStartsOn={userProfile?.start_of_the_week}
                    variant="select-md"
                    className="w-36 max-w-full"
                    formatToken="yyyy-MM-dd"
                  />
                )}
              </div>
              {!neverExpires && (
                <span className="text-caption-sm-regular text-placeholder">
                  {expiredAt === "custom"
                    ? customDate
                      ? translate("web.runtime.expires_at", {
                          date: renderFormattedDate(customDateFormatted ?? "") ?? "",
                          time: renderFormattedTime(customDateFormatted ?? "") ?? "",
                        })
                      : t("web.please_select_an_expiration_date")
                    : expiredAt
                      ? translate("web.runtime.expires_at", {
                          date: renderFormattedDate(expiryDate ?? "") ?? "",
                          time: renderFormattedTime(expiryDate ?? "") ?? "",
                        })
                      : null}
                </span>
              )}
            </div>
          </div>
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <DialogInfo>
          <label className="flex cursor-pointer items-center gap-2">
            <Switch
              size="md"
              checked={readOnly}
              onCheckedChange={setReadOnly}
              aria-label={t("workspace_settings.settings.api_tokens.read_only")}
            />
            <span>{t("workspace_settings.settings.api_tokens.read_only")}</span>
          </label>
        </DialogInfo>
        <Button variant="secondary" size="sm" stretch="auto" label={t("cancel")} onClick={handleClose} />
        <Button
          variant="primary"
          type="submit"
          size="sm"
          stretch="auto"
          label={
            isSubmitting
              ? t("workspace_settings.settings.api_tokens.generating")
              : t("workspace_settings.settings.api_tokens.generate_token")
          }
          loading={isSubmitting}
          disabled={expiredAt === "custom" && !customDate}
        />
      </DialogActions>
    </form>
  );
}
