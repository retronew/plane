import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import type { TDailyDigestPreview } from "@plane/types";
import { DigestPreview } from "./digest-preview";

export function DigestFeedback({
  saving,
  saveState,
  previewLoading,
  previewError,
  preview,
  previewStale,
  canPreview,
  onPreview,
  onDismiss,
}: {
  saving: boolean;
  saveState: "idle" | "saved" | "error";
  previewLoading: boolean;
  previewError: boolean;
  preview: TDailyDigestPreview | undefined;
  previewStale: boolean;
  canPreview: boolean;
  onPreview: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const status = saving ? "saving" : saveState === "saved" ? "saved" : "auto_save";
  return (
    <>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <output className="text-12 text-secondary">{t(`notification_preferences.digest.${status}`)}</output>
        <Button
          stretch="auto"
          variant="secondary"
          size="sm"
          disabled={saving || previewLoading || !canPreview}
          loading={previewLoading}
          label={t("notification_preferences.digest.preview")}
          onClick={onPreview}
        />
      </div>
      {saveState === "error" && (
        <p role="alert" className="mt-3 text-13 text-danger-primary">
          {t("notification_preferences.save_error")}
        </p>
      )}
      {previewError && (
        <p role="alert" className="mt-3 text-13 text-danger-primary">
          {t("notification_preferences.digest.preview_error")}
        </p>
      )}
      {preview && (
        <section
          className="overflow-hidden rounded-lg border border-subtle"
          aria-label={t("notification_preferences.digest.preview_title")}
        >
          <div className="border-b border-subtle bg-layer-1 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-14 font-medium text-primary">{t("notification_preferences.digest.preview_title")}</h4>
              <Button
                stretch="auto"
                variant="secondary"
                size="sm"
                label={t("notification_preferences.digest.hide_preview")}
                onClick={onDismiss}
              />
            </div>
            <p className="mt-1 min-h-5 text-12 text-secondary">
              {t(
                previewStale
                  ? "notification_preferences.digest.preview_stale"
                  : "notification_preferences.digest.preview_hint"
              )}
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto p-4">
            <DigestPreview digest={preview} />
          </div>
        </section>
      )}
    </>
  );
}
