import { useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Switch } from "@makeplane/propel/components/switch";
import { useTranslation } from "@plane/i18n";
import { DailyDigestService } from "@plane/services";
import type { TDailyDigestPreview, TDailyDigestSettingsPatch } from "@plane/types";
import { DigestFeedback } from "./digest-feedback";
import { DigestControls } from "./digest-controls";
import { useDigestSettings } from "./use-digest-settings";

const service = new DailyDigestService();
export function DailyDigestSettings() {
  const { t } = useTranslation();
  const { data, error, mutate, update: saveSettings, saving, saveState } = useDigestSettings();
  const [previewStale, setPreviewStale] = useState(false);
  const [preview, setPreview] = useState<TDailyDigestPreview>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const previewVersion = useRef(0);

  function update(patch: TDailyDigestSettingsPatch) {
    previewVersion.current += 1;
    setPreviewStale(true);
    setPreviewError(false);
    void saveSettings(patch);
  }

  async function loadPreview() {
    const version = ++previewVersion.current;
    setPreviewLoading(true);
    setPreviewError(false);
    try {
      const result = await service.preview();
      if (version === previewVersion.current) {
        setPreview(result);
        setPreviewStale(false);
      }
    } catch {
      if (version === previewVersion.current) setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <section aria-label={t("notification_preferences.digest.title")} className="space-y-4" aria-busy={saving}>
      <div>
        <h3 className="text-16 font-medium text-primary">{t("notification_preferences.digest.title")}</h3>
        <p className="mt-1 text-13 text-secondary">{t("notification_preferences.digest.description")}</p>
      </div>
      {error ? (
        <div role="alert" className="space-y-2 text-13 text-secondary">
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
        <output className="text-13 text-secondary">{t("notification_preferences.loading")}</output>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-lg bg-layer-1 px-4 py-3">
            <div>
              <h4 className="text-14 font-medium text-primary">{t("notification_preferences.digest.enabled")}</h4>
              <p className="mt-1 text-12 text-secondary">{t("notification_preferences.digest.enabled_note")}</p>
            </div>
            <Switch
              size="md"
              checked={data.enabled}
              disabled={!data.enabled && (!data.channels.length || !data.modules.length)}
              aria-label={t("notification_preferences.digest.enabled")}
              onCheckedChange={(enabled) => void update({ enabled })}
            />
          </div>
          <DigestFeedback
            saving={saving}
            saveState={saveState}
            previewLoading={previewLoading}
            previewError={previewError}
            preview={preview}
            previewStale={previewStale}
            canPreview={data.modules.length > 0}
            onPreview={() => void loadPreview()}
            onDismiss={() => setPreview(undefined)}
          />
          <DigestControls settings={data} disabled={false} onChange={(patch) => void update(patch)} />
          {(!data.channels.length || !data.modules.length) && (
            <p className="mt-3 text-13 text-secondary">{t("notification_preferences.digest.selection_required")}</p>
          )}
        </div>
      )}
    </section>
  );
}
