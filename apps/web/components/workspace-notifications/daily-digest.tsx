import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import type { TDailyDigestPreview } from "@plane/types";
import { DigestPreview } from "@/components/settings/profile/content/pages/notifications/digest-preview";

export function DailyDigestNotification({ digest, onBack }: { digest: TDailyDigestPreview; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-18 font-medium text-primary">{t("notification_preferences.digest.title")}</h2>
          <Button
            stretch="auto"
            variant="secondary"
            size="sm"
            label={t("notification_preferences.digest.back")}
            onClick={onBack}
          />
        </div>
        <DigestPreview digest={digest} />
      </div>
    </div>
  );
}
