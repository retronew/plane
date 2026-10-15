import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
export default function AnalyticsRequestError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-subtle p-5"
    >
      <p className="text-13 text-tertiary">{t("workspace_analytics.details.load_error")}</p>
      <Button variant="secondary" size="md" stretch="auto" label={t("common.retry")} onClick={onRetry} />
    </div>
  );
}
