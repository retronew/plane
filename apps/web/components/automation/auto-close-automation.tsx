import { Link, useParams } from "react-router";
import { observer } from "mobx-react";
import { Switch } from "@makeplane/propel/components/switch";
import { Select, SelectTrigger, SelectContent, SelectList, SelectItem } from "@makeplane/propel/components/select";
import { EUserPermissions, EUserPermissionsLevel, EIconSize } from "@plane/constants";
import { StateGroupIcon } from "@plane/blocks/icons";
import { Translation, useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserPermissions } from "@/hooks/store/user";
import { AutomationSettingCard } from "./setting-card";
import { AutomationDaysSelect } from "./days-select";
export const AutoCloseAutomation = observer(function AutoCloseAutomation({
  handleChange,
  disabled = false,
}: {
  handleChange: (data: Partial<IProject>) => Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams();
  const { currentProjectDetails: project } = useProject();
  const { projectStates } = useProjectState();
  const { allowPermissions } = useUserPermissions();
  const editable = !disabled && !!project && allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);
  const days = project?.close_in ?? 0,
    states = (projectStates ?? []).filter((state) => state.group === "cancelled");
  const selected = states.find((state) => state.id === project?.default_state) ?? states[0];
  return (
    <AutomationSettingCard
      expanded={days > 0}
      title={t("project_settings.automations.auto-close.title")}
      description={t("project_settings.automations.auto-close.description")}
      control={
        <Switch
          size="md"
          checked={days > 0}
          disabled={!editable || !selected}
          aria-label={t("project_settings.automations.auto-close.title")}
          onCheckedChange={(checked) =>
            void handleChange({ close_in: checked ? 30 : 0, default_state: checked ? selected?.id : null }).catch(
              () => undefined
            )
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0 flex-1 text-13 font-medium">{t("project_settings.automations.auto-close.duration")}</p>
          <div className="w-52 max-w-[50%] shrink-0">
            <AutomationDaysSelect
              value={days}
              label={t("project_settings.automations.auto-close.duration")}
              disabled={!editable || days === 0}
              onChange={(nextDays) => handleChange({ close_in: nextDays })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0 flex-1 text-13 font-medium">
            {t("project_settings.automations.auto-close.auto_close_status")}
          </p>
          <div className="w-52 max-w-[50%] shrink-0 [&_button]:w-full [&_button]:min-w-0">
            <Select<string>
              value={selected?.id ?? null}
              items={states.map((state) => ({ value: state.id, label: state.name }))}
              disabled={!editable || !states.length || days === 0}
              onValueChange={(value) => {
                if (value) void handleChange({ default_state: value }).catch(() => undefined);
              }}
            >
              <SelectTrigger
                aria-label={t("project_settings.automations.auto-close.auto_close_status")}
                size="lg"
                width="fit"
                placeholder={t("state")}
                icon={
                  selected ? (
                    <StateGroupIcon
                      stateGroup={selected.group}
                      color={selected.color}
                      icon={selected.icon}
                      size={EIconSize.LG}
                    />
                  ) : undefined
                }
              />
              <SelectContent sizing="anchor-fixed">
                <SelectList>
                  {states.map((state) => (
                    <SelectItem
                      key={state.id}
                      value={state.id}
                      label={state.name}
                      icon={
                        <StateGroupIcon
                          stateGroup={state.group}
                          color={state.color}
                          icon={state.icon}
                          size={EIconSize.LG}
                        />
                      }
                    />
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-12 text-tertiary">
          <Translation
            translationKey="project_settings.automations.auto-close.state_hint"
            components={{
              settings: (
                <Link
                  to={`/${workspaceSlug}/settings/projects/${project?.id}/states/`}
                  className="rounded-xs text-accent-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-strong"
                >
                  {t("project_settings.automations.auto-close.state_settings")}
                </Link>
              ),
            }}
          />
        </p>
      </div>
    </AutomationSettingCard>
  );
});
