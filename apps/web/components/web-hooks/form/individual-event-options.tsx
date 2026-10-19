/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import type { IWebhook } from "@plane/types";
import { getWebhookGroupEvents, toggleWebhookEvents } from "./event-selection";
import { useTranslation } from "@plane/i18n";
import { INDIVIDUAL_WEBHOOK_OPTIONS } from "./individual-event-options-data";

type Props = {
  control: Control<IWebhook, any>;
};

export function WebhookIndividualEventOptions({ control }: Props) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name="events"
      render={({ field: { value = [], onChange } }) => {
        const valueSet = new Set(value);
        return (
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 px-6 lg:grid-cols-2">
            {INDIVIDUAL_WEBHOOK_OPTIONS.map((option) => {
              const events = getWebhookGroupEvents(option.key);
              const selectedCount = events.filter((event) => valueSet.has(event)).length;
              return (
                <div key={option.key}>
                  <div className="mb-2 flex items-center gap-2">
                    <Checkbox
                      id={`webhook-${option.key}`}
                      name={option.key}
                      aria-label={option.label}
                      checked={selectedCount === events.length}
                      indeterminate={selectedCount > 0 && selectedCount < events.length}
                      onCheckedChange={(checked) => onChange(toggleWebhookEvents(value, events, checked === true))}
                    />
                    <label htmlFor={`webhook-${option.key}`} className="cursor-pointer text-body-sm-regular">
                      {option.label}
                    </label>
                  </div>
                  <div className="ml-[7px] flex flex-col">
                    {events.map((event, index) => (
                      <div key={event} className="relative flex items-center gap-2 py-1 pl-5">
                        <span
                          aria-hidden
                          className="absolute top-0 bottom-1/2 left-0 w-2 rounded-bl-md border-b border-l border-subtle"
                        />
                        {index < events.length - 1 && (
                          <span aria-hidden className="absolute -top-1 bottom-0 left-0 border-l border-subtle" />
                        )}
                        <Checkbox
                          id={`webhook-${event}`}
                          name={event}
                          aria-label={t(`web.webhook_event_${event.split(".")[1]}`)}
                          checked={valueSet.has(event)}
                          onCheckedChange={(checked) => onChange(toggleWebhookEvents(value, [event], checked === true))}
                        />
                        <label htmlFor={`webhook-${event}`} className="cursor-pointer text-body-xs-regular">
                          {t(`web.webhook_event_${event.split(".")[1]}`)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }}
    />
  );
}
