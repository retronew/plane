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
import { translate, useTranslation } from "@plane/i18n";

export const INDIVIDUAL_WEBHOOK_OPTIONS: {
  key: keyof IWebhook;
  label: string;
  description: string;
}[] = [
  {
    key: "project",
    get label() {
      return translate("web.projects");
    },
    get description() {
      return translate("web.project_created_updated_or_deleted");
    },
  },
  {
    key: "cycle",
    get label() {
      return translate("web.cycles");
    },
    get description() {
      return translate("web.cycle_created_updated_or_deleted");
    },
  },
  {
    key: "issue",
    get label() {
      return translate("web.work_items_af8f");
    },
    get description() {
      return translate("web.work_item_created_updated_deleted_added_to_a_cycle_or_module");
    },
  },
  {
    key: "module",
    get label() {
      return translate("web.title_modules");
    },
    get description() {
      return translate("web.module_created_updated_or_deleted");
    },
  },
  {
    key: "issue_comment",
    get label() {
      return translate("web.work_item_comments");
    },
    get description() {
      return translate("web.comment_posted_updated_or_deleted");
    },
  },
];

type Props = {
  control: Control<IWebhook, any>;
};

export function WebhookIndividualEventOptions({ control }: Props) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name="events"
      render={({ field: { value = [], onChange } }) => (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 px-6 lg:grid-cols-2">
          {INDIVIDUAL_WEBHOOK_OPTIONS.map((option) => {
            const events = getWebhookGroupEvents(option.key);
            const selectedCount = events.filter((event) => value.includes(event)).length;
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
                        checked={value.includes(event)}
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
      )}
    />
  );
}
