import { observer } from "mobx-react";
import { Switch } from "@makeplane/propel/components/switch";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { AutomationSettingCard } from "./setting-card";
import { AutomationDaysSelect } from "./days-select";
export const AutoArchiveAutomation = observer(function AutoArchiveAutomation({
  handleChange,
  disabled = false,
}: {
  handleChange: (data: Partial<IProject>) => Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { currentProjectDetails: project } = useProject();
  const { allowPermissions } = useUserPermissions();
  const editable = !disabled && !!project && allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);
  const days = project?.archive_in ?? 0;
  return (
    <AutomationSettingCard
      expanded={days > 0}
      title={t("project_settings.automations.auto-archive.title")}
      description={t("project_settings.automations.auto-archive.description")}
      control={
        <Switch
          size="md"
          checked={days > 0}
          disabled={!editable}
          aria-label={t("project_settings.automations.auto-archive.title")}
          onCheckedChange={(checked) => void handleChange({ archive_in: checked ? 30 : 0 }).catch(() => undefined)}
        />
      }
    >
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 flex-1 text-13 font-medium">{t("project_settings.automations.auto-archive.duration")}</p>
        <div className="w-52 max-w-[50%] shrink-0">
          <AutomationDaysSelect
            value={days}
            label={t("project_settings.automations.auto-archive.duration")}
            disabled={!editable || days === 0}
            onChange={(nextDays) => handleChange({ archive_in: nextDays })}
          />
        </div>
      </div>
    </AutomationSettingCard>
  );
});
