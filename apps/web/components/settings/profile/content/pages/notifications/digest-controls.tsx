import type { ReactNode } from "react";
import { Switch } from "@makeplane/propel/components/switch";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { useTranslation } from "@plane/i18n";
import { DAILY_DIGEST_MODULES, NOTIFICATION_CHANNELS } from "@plane/types";
import type { TDailyDigestSettings, TDailyDigestSettingsPatch } from "@plane/types";
import { DigestScope } from "./digest-scope";

const hours = Array.from({ length: 24 }, (_, value) => ({
  value: String(value).padStart(2, "0"),
  label: String(value).padStart(2, "0"),
}));
const minutes = Array.from({ length: 60 }, (_, value) => ({
  value: String(value).padStart(2, "0"),
  label: String(value).padStart(2, "0"),
}));

function DigestSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select<string>
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger size="md" width="fit" aria-label={label} />
      <SelectContent>
        <SelectList>
          {options.map((option) => (
            <SelectItem key={option.value} {...option} size="md" />
          ))}
        </SelectList>
      </SelectContent>
    </Select>
  );
}

function DigestSettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-subtle pt-5">
      <h4 className="text-14 font-medium text-primary">{title}</h4>
      {children}
    </section>
  );
}

export function DigestControls({
  settings,
  disabled,
  onChange,
}: {
  settings: TDailyDigestSettings;
  disabled: boolean;
  onChange: (patch: TDailyDigestSettingsPatch) => void;
}) {
  const { t } = useTranslation();
  const [hour, minute] = settings.send_time.split(":");
  return (
    <div className="space-y-5">
      <DigestSettingGroup title={t("notification_preferences.digest.delivery_title")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-13 text-secondary">{t("notification_preferences.digest.send_time")}</p>
            <div className="flex items-center gap-2">
              <DigestSelect
                label={t("notification_preferences.digest.hour")}
                value={hour}
                options={hours}
                disabled={disabled}
                onChange={(value) => onChange({ send_time: `${value}:${minute}` })}
              />
              <span aria-hidden="true" className="text-secondary">
                :
              </span>
              <DigestSelect
                label={t("notification_preferences.digest.minute")}
                value={minute}
                options={minutes}
                disabled={disabled}
                onChange={(value) => onChange({ send_time: `${hour}:${value}` })}
              />
              <span className="ml-1 text-12 text-secondary">{settings.timezone}</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-13 text-secondary">{t("notification_preferences.digest.delivery_days")}</p>
            <label className="flex min-h-8 items-center justify-between gap-3 text-13 text-primary">
              {t("notification_preferences.digest.weekdays_only")}
              <Switch
                size="md"
                checked={settings.weekdays_only}
                disabled={disabled}
                aria-label={t("notification_preferences.digest.weekdays_only")}
                onCheckedChange={(weekdays_only) => onChange({ weekdays_only })}
              />
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-13 text-secondary">{t("notification_preferences.channels_title")}</p>
          <div className="flex flex-wrap gap-2">
            {NOTIFICATION_CHANNELS.map((channel) => (
              <label
                key={channel}
                className="flex items-center gap-3 rounded-md border border-subtle px-3 py-2 text-13 text-primary"
              >
                <Switch
                  size="md"
                  checked={settings.channels.includes(channel)}
                  disabled={
                    disabled ||
                    (settings.enabled && settings.channels.length === 1 && settings.channels.includes(channel))
                  }
                  aria-label={t("notification_preferences.digest.channel_label", {
                    channel: t(`notification_preferences.channels.${channel}`),
                  })}
                  onCheckedChange={(checked) =>
                    onChange({
                      channels: checked
                        ? [...settings.channels, channel]
                        : settings.channels.filter((value) => value !== channel),
                    })
                  }
                />
                {t(`notification_preferences.channels.${channel}`)}
              </label>
            ))}
          </div>
          <p className="text-12 leading-5 text-secondary">{t("notification_preferences.digest.delivery_note")}</p>
        </div>
      </DigestSettingGroup>
      <DigestSettingGroup title={t("notification_preferences.digest.contents")}>
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {DAILY_DIGEST_MODULES.map((module) => (
            <div
              key={module}
              className="flex min-w-0 items-start justify-between gap-3 rounded-md bg-layer-1 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-13 font-medium text-primary">
                  {t(`notification_preferences.digest.modules.${module}`)}
                </p>
                <p className="mt-1 text-12 leading-5 text-secondary">
                  {t(`notification_preferences.digest.module_hints.${module}`)}
                </p>
              </div>
              <Switch
                size="md"
                checked={settings.modules.includes(module)}
                disabled={
                  disabled || (settings.enabled && settings.modules.length === 1 && settings.modules.includes(module))
                }
                aria-label={t(`notification_preferences.digest.modules.${module}`)}
                onCheckedChange={(checked) =>
                  onChange({
                    modules: checked
                      ? [...settings.modules, module]
                      : settings.modules.filter((value) => value !== module),
                  })
                }
              />
            </div>
          ))}
        </div>
        {settings.modules.includes("due_soon") && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-13 text-secondary">
            <span>{t("notification_preferences.digest.due_soon_days")}</span>
            <DigestSelect
              label={t("notification_preferences.digest.due_soon_days")}
              value={String(settings.due_soon_days)}
              disabled={disabled}
              options={Array.from({ length: 30 }, (_, index) => ({
                value: String(index + 1),
                label: t("notification_preferences.digest.days", { count: index + 1 }),
              }))}
              onChange={(value) => onChange({ due_soon_days: Number(value) })}
            />
          </div>
        )}
        <p className="text-12 leading-5 text-secondary">{t("notification_preferences.digest.content_note")}</p>
      </DigestSettingGroup>
      <DigestSettingGroup title={t("notification_preferences.digest.scope")}>
        <DigestScope settings={settings} disabled={disabled} onChange={onChange} />
      </DigestSettingGroup>
      <DigestSettingGroup title={t("notification_preferences.digest.display_title")}>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 text-13 text-primary">
            <span>
              {t("notification_preferences.digest.include_details")}
              <span className="mt-1 block text-12 text-secondary">
                {t("notification_preferences.digest.details_hint")}
              </span>
            </span>
            <Switch
              size="md"
              checked={settings.include_details}
              disabled={disabled}
              aria-label={t("notification_preferences.digest.include_details")}
              onCheckedChange={(include_details) => onChange({ include_details })}
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-13 text-primary">
            {t("notification_preferences.digest.send_empty")}
            <Switch
              size="md"
              checked={settings.send_empty}
              disabled={disabled}
              aria-label={t("notification_preferences.digest.send_empty")}
              onCheckedChange={(send_empty) => onChange({ send_empty })}
            />
          </label>
        </div>
      </DigestSettingGroup>
    </div>
  );
}
