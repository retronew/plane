/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { InputField } from "@makeplane/propel/components/input-field";
import React from "react";
import { normalizeWebhookEvents } from "./event-selection";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import type { IWebhook, TWebhookEventTypes } from "@plane/types";
// hooks
import { WebhookIndividualEventOptions, WebhookInput, WebhookSecretKey, WebhookToggle } from "@/components/web-hooks";
import { useWebhook } from "@/hooks/store/use-webhook";
// components
// ui
// types

type Props = {
  data?: Partial<IWebhook>;
  onSubmit: (data: IWebhook, webhookEventType: TWebhookEventTypes) => Promise<void>;
  handleClose?: () => void;
};

const initialWebhookPayload: Partial<IWebhook> = {
  cycle: true,
  issue: true,
  issue_comment: true,
  module: true,
  project: true,
  url: "",
  name: "",
};

export const WebhookForm = observer(function WebhookForm(props: Props) {
  const { data, onSubmit, handleClose } = props;
  // store hooks
  const { webhookSecretKey } = useWebhook();
  const { t } = useTranslation();
  // use form
  const {
    handleSubmit,
    control,
    formState: { isSubmitting, errors },
  } = useForm<IWebhook>({
    defaultValues: { ...initialWebhookPayload, ...data, events: normalizeWebhookEvents(data) },
  });

  const handleFormSubmit = async (formData: IWebhook) => {
    await onSubmit(
      { ...formData, project: false, cycle: false, module: false, issue: false, issue_comment: false },
      "individual"
    );
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="flex flex-col gap-7">
        <div className="mb-[-12px] border-b border-subtle pb-3 text-h3-medium text-primary">
          {data
            ? t("workspace_settings.settings.webhooks.modal.details")
            : t("workspace_settings.settings.webhooks.modal.title")}
        </div>
        <div className="flex flex-col gap-4">
          <Controller
            control={control}
            name="name"
            rules={{ required: t("web.webhook_name_required") }}
            render={({ field }) => (
              <InputField
                {...field}
                value={field.value ?? ""}
                size="lg"
                orientation="vertical"
                label={t("web.webhook_name")}
                required
                placeholder={t("web.webhook_name_placeholder")}
                maxLength={255}
              />
            )}
          />
          {errors.name && <p className="text-11 text-danger-primary">{errors.name.message}</p>}
          <div className="space-y-2">
            <Controller
              control={control}
              name="url"
              rules={{
                required: t("workspace_settings.settings.webhooks.modal.error"),
              }}
              render={({ field: { onChange, value } }) => (
                <WebhookInput value={value} onChange={onChange} hasError={Boolean(errors.url)} />
              )}
            />
            {errors.url && <div className="text-11 text-danger-primary">{errors.url.message}</div>}
          </div>
          {data && <WebhookToggle control={control} />}
        </div>
        <fieldset className="space-y-5 pb-7">
          <legend className="text-13 font-medium">{t("workspace_settings.settings.webhooks.modal.question")}</legend>
          <div>
            <WebhookIndividualEventOptions control={control} />
          </div>
        </fieldset>
      </div>
      {data ? (
        <div className="space-y-5 pt-0">
          <WebhookSecretKey data={data} />
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            type="submit"
            label={isSubmitting ? t("updating") : t("update")}
            loading={isSubmitting}
          />
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2 border-t-[0.5px] border-subtle py-4">
          <Button variant="secondary" size="md" stretch="auto" label={t("cancel")} onClick={handleClose} />
          {!webhookSecretKey && (
            <Button
              type="submit"
              variant="primary"
              size="md"
              stretch="auto"
              label={isSubmitting ? t("common.creating") : t("common.create")}
              loading={isSubmitting}
            />
          )}
        </div>
      )}
    </form>
  );
});
