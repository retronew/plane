import { useRef, useState } from "react";
import useSWR from "swr";
import { Switch } from "@makeplane/propel/components/switch";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { InstanceService } from "@plane/services";
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from "@plane/types";
import type { TNotificationPreferencesPatch } from "@plane/types";

const service = new InstanceService();

export function UserNotificationPreferences({
  userId,
  disabled,
  onBusyChange,
}: {
  userId: string;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data, error, mutate } = useSWR(["INSTANCE_USER_NOTIFICATION_PREFERENCES", userId], () =>
    service.getUserNotificationPreferences(userId)
  );
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  async function update(patch: TNotificationPreferencesPatch) {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setSaving(true);
    onBusyChange(true);
    setFailed(false);
    try {
      await mutate(await service.updateUserNotificationPreferences(userId, patch), { revalidate: false });
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }
  return (
    <section className="space-y-4 border-t border-subtle pt-4" aria-busy={saving}>
      <h3 className="text-14 font-medium">{t("notification_preferences.channels_title")}</h3>
      <p className="text-13 text-secondary">{t("admin.users.notifications.description")}</p>
      {error ? (
        <div role="alert" className="space-y-2 text-13">
          <p>{t("notification_preferences.load_error")}</p>
          <Button
            stretch="auto"
            variant="secondary"
            size="sm"
            label={t("notification_preferences.retry")}
            onClick={() => void mutate()}
          />
        </div>
      ) : !data ? (
        <output>{t("notification_preferences.loading")}</output>
      ) : (
        <>
          {failed && (
            <p role="alert" className="text-13 text-danger-primary">
              {t("notification_preferences.save_error")}
            </p>
          )}
          {NOTIFICATION_CHANNELS.map((channel) => (
            <div key={channel} className="space-y-3 rounded-md border border-subtle p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-13">{t(`notification_preferences.channels.${channel}`)}</span>
                <Switch
                  size="md"
                  checked={data.channels[channel]}
                  disabled={disabled || saving}
                  aria-label={t(`notification_preferences.channels.${channel}`)}
                  onCheckedChange={(value) => void update({ channels: { [channel]: value } })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-13">
                  <p>{t("notification_preferences.force")}</p>
                  <p className="text-12 text-secondary">{t("notification_preferences.force_description")}</p>
                </div>
                <Switch
                  size="md"
                  checked={data.override_scopes[channel]}
                  disabled={disabled || saving}
                  aria-label={`${t(`notification_preferences.channels.${channel}`)} · ${t("notification_preferences.force")}`}
                  onCheckedChange={(value) => void update({ override_scopes: { [channel]: value } })}
                />
              </div>
            </div>
          ))}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-13">
              <caption className="pb-3 text-left text-secondary">
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
                    {NOTIFICATION_CHANNELS.map((channel) => (
                      <td key={channel} className="p-2">
                        <Switch
                          size="md"
                          checked={data.events[channel][event] === true}
                          disabled={disabled || saving}
                          aria-label={t("notification_preferences.cell_label", {
                            event: t(`notification_preferences.events.${event}`),
                            channel: t(`notification_preferences.channels.${channel}`),
                          })}
                          onCheckedChange={(value) => void update({ events: { [channel]: { [event]: value } } })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
