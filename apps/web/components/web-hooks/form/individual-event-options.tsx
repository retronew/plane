/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { CheckboxField } from "@makeplane/propel/components/checkbox-field";
import type { IWebhook } from "@plane/types";
import { translate } from "@plane/i18n";

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
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 px-6 lg:grid-cols-2">
      {INDIVIDUAL_WEBHOOK_OPTIONS.map((option) => (
        <Controller
          key={option.key}
          control={control}
          name={option.key}
          render={({ field: { onChange, value } }) => (
            <CheckboxField
              name={option.key}
              label={option.label}
              size="lg"
              description={option.description}
              stretch="full"
              checked={value === true}
              onCheckedChange={onChange}
            />
          )}
        />
      ))}
    </div>
  );
}
