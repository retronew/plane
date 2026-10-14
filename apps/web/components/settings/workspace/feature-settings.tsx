import { cn } from "@plane/utils";
import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { Switch } from "@makeplane/propel/components/switch";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
import { WORKSPACE_SETTINGS_ICONS } from "./sidebar/item-icon";

type Props = {
  children?: React.ReactNode;
  feature: "projects" | "ai";
  field: "allow_member_project_creation" | "ai_enabled";
};

export const WorkspaceFeatureSettings = observer(function WorkspaceFeatureSettings({
  feature,
  field,
  children,
}: Props) {
  const { workspaceSlug } = useParams();
  const { getWorkspaceBySlug, updateWorkspace } = useWorkspace();
  const { allowPermissions } = useUserPermissions();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const workspace = workspaceSlug ? getWorkspaceBySlug(workspaceSlug) : null;
  const canManage = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);
  const Icon = WORKSPACE_SETTINGS_ICONS[feature];
  const title = t(`web.workspace_${feature}_title`);

  const save = async (enabled: boolean) => {
    if (!workspaceSlug || !canManage || saving) return;
    setSaving(true);
    try {
      await updateWorkspace(workspaceSlug, { [field]: enabled });
      setToast({ type: "success", title: t("web.workspace_feature_saved") });
    } catch {
      setToast({ type: "error", title: t("toast.error"), message: t("web.workspace_update_failed") });
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return <NotAuthorizedView section="settings" className="h-auto" />;
  return (
    <SettingsContentWrapper
      compact
      header={
        <SettingsPageHeader
          leftItem={
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-tertiary" />
              <span>{title}</span>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        <SettingsHeading title={title} description={t(`web.workspace_${feature}_description`)} />
        <div
          className={cn(
            "flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:gap-8",
            "rounded-lg border border-subtle bg-layer-2 px-4 py-3"
          )}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={`workspace-${field}`} className="text-13 font-medium text-primary">
              {t(`web.workspace_${feature}_toggle`)}
            </label>
            <p className="text-13 text-tertiary">{t(`web.workspace_${feature}_hint`)}</p>
          </div>
          <Switch
            id={`workspace-${field}`}
            size="md"
            checked={workspace?.[field] ?? true}
            disabled={saving || !workspace}
            onCheckedChange={(enabled) => void save(enabled)}
          />
        </div>
        {children}
      </div>
    </SettingsContentWrapper>
  );
});
