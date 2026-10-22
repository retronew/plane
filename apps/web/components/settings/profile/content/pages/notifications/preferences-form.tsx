import { useRef, useState } from "react";
import useSWR from "swr";
import { Switch } from "@makeplane/propel/components/switch";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { NotificationPreferencesService } from "@plane/services";
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@plane/types";
import type { TNotificationPreferencesPatch, TNotificationScope } from "@plane/types";
import { SettingsControlItem } from "@/components/settings/control-item";

const service = new NotificationPreferencesService();
const selectClass = "rounded-md border border-subtle bg-surface-1 px-2 py-1.5 text-13 text-primary";

const GLOBAL_SCOPE: TNotificationScope = {};

export function NotificationPreferencesForm({ scope = GLOBAL_SCOPE }: { scope?: TNotificationScope }) {
  const { t } = useTranslation();
  const global = !scope.workspace_id;
  const { data, error, mutate } = useSWR(["NOTIFICATION_PREFERENCES", scope.workspace_id, scope.project_id], () =>
    service.retrieve(scope)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savingRef = useRef(false);
  async function update(patch: TNotificationPreferencesPatch) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      await mutate(await service.update(patch, scope), { revalidate: false });
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  if (error)
    return (
      <div role="alert">
        {t("notification_preferences.load_error")}
        <Button
          stretch="auto"
          variant="secondary"
          size="sm"
          label={t("notification_preferences.retry")}
          onClick={() => void mutate()}
        />
      </div>
    );
  if (!data) return <output>{t("notification_preferences.loading")}</output>;
  return (
    <div className="space-y-5" aria-busy={saving}>
      {saveError && (
        <p role="alert" className="text-13 text-danger-primary">
          {t("notification_preferences.save_error")}
        </p>
      )}
      {global && (
        <section aria-label={t("notification_preferences.channels_title")} className="space-y-4">
          <h3 className="text-16 font-medium">{t("notification_preferences.channels_title")}</h3>
          {NOTIFICATION_CHANNELS.map((channel) => (
            <div key={channel} className="rounded-md border border-subtle px-4">
              <SettingsControlItem
                title={t(`notification_preferences.channels.${channel}`)}
                description={t("notification_preferences.channel_description", {
                  channel: t(`notification_preferences.channels.${channel}`),
                })}
                control={
                  <Switch
                    size="md"
                    checked={data.channels[channel]}
                    disabled={saving}
                    aria-label={t(`notification_preferences.channels.${channel}`)}
                    onCheckedChange={(value) => void update({ channels: { [channel]: value } })}
                  />
                }
              />
              <SettingsControlItem
                title={t("notification_preferences.force")}
                description={t("notification_preferences.force_description")}
                control={
                  <Switch
                    size="md"
                    checked={data.override_scopes[channel]}
                    disabled={saving}
                    aria-label={`${t(`notification_preferences.channels.${channel}`)} · ${t("notification_preferences.force")}`}
                    onCheckedChange={(value) => void update({ override_scopes: { [channel]: value } })}
                  />
                }
              />
            </div>
          ))}
        </section>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-13">
          <caption className="pb-3 text-left text-13 text-secondary">
            {t("notification_preferences.events_description")}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="p-2">
                {t("notification_preferences.event")}
              </th>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <th key={channel} scope="col" className="p-2">
                  {t(`notification_preferences.channels.${channel}`)}
                  {!global && data.override_scopes[channel] && (
                    <p className="font-normal max-w-44 text-11 text-secondary">
                      {t("notification_preferences.forced")}
                    </p>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((event) => (
              <tr key={event} className="border-t border-subtle">
                <th scope="row" className="font-normal p-2">
                  {t(`notification_preferences.events.${event}`)}
                </th>
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const value = data.events[channel][event];
                  const effective = data.effective[channel][event];
                  const label = t("notification_preferences.cell_label", {
                    event: t(`notification_preferences.events.${event}`),
                    channel: t(`notification_preferences.channels.${channel}`),
                  });
                  return (
                    <td key={channel} className="p-2 align-top">
                      {global ? (
                        <Switch
                          size="md"
                          checked={value === true}
                          disabled={saving}
                          aria-label={label}
                          onCheckedChange={(enabled) => void update({ events: { [channel]: { [event]: enabled } } })}
                        />
                      ) : (
                        <select
                          className={selectClass}
                          aria-label={label}
                          disabled={saving}
                          value={value === null ? "inherit" : value ? "on" : "off"}
                          onChange={(e) =>
                            void update({
                              events: {
                                [channel]: { [event]: e.target.value === "inherit" ? null : e.target.value === "on" },
                              },
                            })
                          }
                        >
                          <option value="inherit">{t("notification_preferences.inherit")}</option>
                          <option value="on">{t("notification_preferences.on")}</option>
                          <option value="off">{t("notification_preferences.off")}</option>
                        </select>
                      )}
                      <p className="mt-1 max-w-44 text-11 text-secondary">
                        {t("notification_preferences.effective", {
                          value: t(effective.enabled ? "notification_preferences.on" : "notification_preferences.off"),
                          source: t(`notification_preferences.sources.${effective.source}`),
                        })}
                      </p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
