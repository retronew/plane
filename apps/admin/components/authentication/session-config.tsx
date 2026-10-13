/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane internal packages
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { Switch } from "@makeplane/propel/components/switch";
import { useTranslation } from "@plane/i18n";
import type { IFormattedInstanceConfiguration, TInstanceSessionConfigurationKeys } from "@plane/types";
import { cn } from "@plane/utils";

const HOUR = 3600;
const DAY = 24 * HOUR;

const USER_SESSION_OPTIONS = [DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY];
const ADMIN_SESSION_OPTIONS = [HOUR, 4 * HOUR, 8 * HOUR, DAY, 7 * DAY];

type Props = {
  config: IFormattedInstanceConfiguration;
  disabled: boolean;
  updateConfig: (key: TInstanceSessionConfigurationKeys, value: string) => void;
};

export const SessionConfiguration = observer(function SessionConfiguration(props: Props) {
  const { config, disabled, updateConfig } = props;
  const { t } = useTranslation();

  const formatDuration = (seconds: number): string => {
    if (seconds % DAY === 0) return t("admin.authentication.session.days", { count: seconds / DAY });
    if (seconds % HOUR === 0) return t("admin.authentication.session.hours", { count: seconds / HOUR });
    return t("admin.authentication.session.minutes", { count: Math.max(1, Math.round(seconds / 60)) });
  };

  // Keep a custom value (e.g. set through env vars) selectable alongside the presets
  const buildItems = (presets: number[], current: number): Record<string, string> => {
    const values = presets.includes(current) || !(current > 0) ? presets : [...presets, current].sort((a, b) => a - b); // oxlint-disable-line unicorn/no-array-sort
    return Object.fromEntries(values.map((value) => [String(value), formatDuration(value)]));
  };

  const renderDurationRow = (
    key: Extract<TInstanceSessionConfigurationKeys, "SESSION_COOKIE_AGE" | "ADMIN_SESSION_COOKIE_AGE">,
    presets: number[],
    title: string,
    description: string
  ) => {
    const current = parseInt(config[key] ?? "", 10);
    const items = buildItems(presets, current);
    return (
      <div className="flex w-full items-center gap-14 rounded-sm">
        <div className="grow">
          <div className="pb-1 text-13 font-medium">{title}</div>
          <div className="text-11 leading-5 font-regular text-tertiary">{description}</div>
        </div>
        <div className={cn("shrink-0 pr-4", disabled && "opacity-70")}>
          <Select
            items={items}
            value={Number.isNaN(current) ? undefined : String(current)}
            onValueChange={(value) => updateConfig(key, String(value))}
            disabled={disabled}
          >
            <SelectTrigger size="lg" aria-label={title} />
            <SelectContent>
              <SelectList>
                {Object.entries(items).map(([value, label]) => (
                  <SelectItem key={value} value={value} label={label} size="lg" />
                ))}
              </SelectList>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const isSlidingEnabled = config.SESSION_SAVE_EVERY_REQUEST === "1";

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-medium">{t("admin.authentication.session.title")}</div>
        <div className="text-11 leading-5 font-regular text-tertiary">
          {t("admin.authentication.session.description")}
        </div>
      </div>
      {renderDurationRow(
        "SESSION_COOKIE_AGE",
        USER_SESSION_OPTIONS,
        t("admin.authentication.session.user_session"),
        t("admin.authentication.session.user_session_description")
      )}
      {renderDurationRow(
        "ADMIN_SESSION_COOKIE_AGE",
        ADMIN_SESSION_OPTIONS,
        t("admin.authentication.session.admin_session"),
        t("admin.authentication.session.admin_session_description")
      )}
      <div className="flex w-full items-center gap-14 rounded-sm">
        <div className="grow">
          <div className="pb-1 text-13 font-medium">{t("admin.authentication.session.extend_on_activity")}</div>
          <div className="text-11 leading-5 font-regular text-tertiary">
            {t("admin.authentication.session.extend_on_activity_description")}
          </div>
        </div>
        <div className={cn("shrink-0 pr-4", disabled && "opacity-70")}>
          <Switch
            aria-label={t("admin.authentication.session.extend_on_activity")}
            checked={isSlidingEnabled}
            onCheckedChange={() => updateConfig("SESSION_SAVE_EVERY_REQUEST", isSlidingEnabled ? "0" : "1")}
            size="sm"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
});
