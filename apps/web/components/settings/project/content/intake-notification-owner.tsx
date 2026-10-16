import { useState } from "react";
import useSWR from "swr";
import { Users, X } from "lucide-react";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { IntakeSettingsService } from "@/services/inbox/intake-settings.service";

const service = new IntakeSettingsService();
export function IntakeNotificationOwner({
  workspaceSlug,
  projectId,
  disabled,
}: {
  workspaceSlug: string;
  projectId: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const { data, error, mutate } = useSWR(["intake-settings", workspaceSlug, projectId], () =>
    service.retrieve(workspaceSlug, projectId)
  );
  const update = async (id: string | null) => {
    if (!data || saving) return;
    setSaving(true);
    try {
      const updated = await service.update(workspaceSlug, projectId, data.id, id);
      await mutate(updated, { revalidate: false });
      setToast({ type: "success", title: t("success"), message: t("web.intake_owner_saved") });
    } catch {
      setToast({ type: "error", title: t("error"), message: t("web.intake_owner_failed") });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="mt-10 space-y-3">
      <h3 className="text-14 font-medium">{t("project_settings.features.intake.intake_responsibility")}</h3>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-subtle p-4">
        <div className="flex min-w-0 items-start gap-2">
          <Users className="mt-0.5 size-4 shrink-0 text-secondary" />
          <div className="space-y-1">
            <h4 className="text-body-sm-medium text-primary">
              {t("project_settings.features.intake.notify_assignee.title")}
            </h4>
            <p className="text-caption-md-regular text-tertiary">
              {t("project_settings.features.intake.notify_assignee.description")}
            </p>
            {(error || data === null) && (
              <button type="button" className="text-12 text-danger-primary" onClick={() => void mutate()}>
                {t("common.retry")}
              </button>
            )}
          </div>
        </div>
        <div className="relative w-52 max-w-[45%] shrink-0">
          <MemberSelect
            value={data?.notification_assignee}
            onChange={(id) => void update(id || null)}
            projectId={projectId}
            variant="select-md"
            disabled={disabled || saving || !data || !!error}
            placeholder={t("web.intake_owner_placeholder")}
            hideChevron={!!data?.notification_assignee}
            className={data?.notification_assignee ? "pr-8" : undefined}
          />
          {!!data?.notification_assignee && !disabled && (
            <span className="absolute inset-y-0 right-1 flex items-center">
              <IconButton
                type="button"
                size="xs"
                variant="ghost"
                icon={<X className="size-3" />}
                disabled={saving}
                aria-label={t("web.intake_owner_clear")}
                onClick={() => void update(null)}
              />
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
