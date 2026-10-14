import { useState } from "react";
import { observer } from "mobx-react";
import { Switch } from "@makeplane/propel/components/switch";
import { Select } from "@plane/blocks/select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TUserProfile } from "@plane/types";
import { SettingsControlItem } from "@/components/settings/control-item";
import { useUserProfile } from "@/hooks/store/user";

const SHORTCUTS = [
  { value: "enter", label: "Enter" },
  { value: "mod-enter", label: "Ctrl / ⌘ + Enter" },
] as const;

export const EditorPreferenceControls = observer(function EditorPreferenceControls() {
  const { data, updateUserProfile } = useUserProfile();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const save = async (changes: Partial<TUserProfile>) => {
    setSaving(true);
    try {
      if (!(await updateUserProfile(changes))) throw new Error("Update failed");
    } catch {
      setToast({ type: "error", title: t("error"), message: t("web.preferences_save_failed") });
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <SettingsControlItem
        title={t("smooth_cursor")}
        description={t("web.smooth_cursor_description")}
        control={
          <Switch
            size="md"
            aria-label={t("smooth_cursor")}
            checked={data.is_smooth_cursor_enabled ?? false}
            disabled={saving}
            onCheckedChange={(checked) => void save({ is_smooth_cursor_enabled: checked })}
          />
        }
      />
      <SettingsControlItem
        title={t("web.comment_submit_shortcut")}
        description={t("web.comment_submit_shortcut_description")}
        control={
          <Select
            getValues={() => [...SHORTCUTS]}
            value={
              SHORTCUTS.find((option) => option.value === (data.comment_submit_shortcut ?? "enter")) ?? SHORTCUTS[0]
            }
            onChange={(value) => void save({ comment_submit_shortcut: value as "enter" | "mod-enter" })}
            getOptionValue={(option) => option.value}
            getOptionLabel={(option) => option.label}
            showSearch={false}
            pinSelected={false}
            disabled={saving}
            contentSizing="anchor"
            placeholder={t("web.comment_submit_shortcut")}
          >
            <Select.Trigger<(typeof SHORTCUTS)[number]> variant="select-md" className="w-42 max-w-full">
              {(options) => <span className="min-w-0 grow truncate text-left">{options[0]?.label}</span>}
            </Select.Trigger>
          </Select>
        }
      />
    </>
  );
});
