import { observer } from "mobx-react";
import { Switch } from "@makeplane/propel/components/switch";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { AutomationDaysSelect } from "./days-select";
import { AutomationSettingCard } from "./setting-card";

export const AutoRemindAutomation = observer(function AutoRemindAutomation({
  handleChange,
  disabled = false,
}: {
  handleChange: (data: Partial<IProject>) => Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { currentProjectDetails: project } = useProject();
  const { allowPermissions } = useUserPermissions();
  const editable = !disabled && allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);
  const days = project?.remind_in ?? 0;
  return (
    <AutomationSettingCard
      expanded={days > 0}
      title={t("project_settings.automations.auto-remind.title")}
      description={t("project_settings.automations.auto-remind.description")}
      control={
        <Switch
          size="md"
          checked={days > 0}
          disabled={!editable || !project}
          aria-label={t("project_settings.automations.auto-remind.title")}
          onCheckedChange={(checked) => void handleChange({ remind_in: checked ? 1 : 0 }).catch(() => undefined)}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0 flex-1 text-13 font-medium">{t("project_settings.automations.auto-remind.duration")}</p>
          <div className="w-52 max-w-[50%] shrink-0">
            <AutomationDaysSelect
              value={days}
              maxDays={7}
              allowCustom={false}
              label={t("project_settings.automations.auto-remind.duration")}
              disabled={!editable || days === 0}
              onChange={(nextDays) => handleChange({ remind_in: nextDays })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-13 font-medium">{t("project_settings.automations.auto-remind.email_label")}</p>
          <Switch
            size="md"
            checked={project?.remind_email_enabled ?? true}
            disabled={!editable || days === 0}
            aria-label={t("project_settings.automations.auto-remind.email_label")}
            onCheckedChange={(checked) => void handleChange({ remind_email_enabled: checked }).catch(() => undefined)}
          />
        </div>
        <p className="text-12 text-tertiary">{t("project_settings.automations.auto-remind.in_app_always_on")}</p>
      </div>
    </AutomationSettingCard>
  );
});
