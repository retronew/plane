import { useLayoutEffect, useState } from "react";
import { CloseOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InputField } from "@makeplane/propel/components/input-field";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogCloseGroup,
} from "@makeplane/propel/components/dialog";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { EmojiPicker } from "@plane/blocks/emoji-icon-picker";
import { useTranslation } from "@plane/i18n";
import type { TLogoProps, TProjectIssueHierarchy, TProjectIssueType } from "@plane/types";
import { TypesLogo } from "./types-logo";

export function TypesEditor({
  type,
  hierarchy,
  onConfigureHierarchy,
  open,
  busy,
  onClose,
  onClosed,
  onSave,
}: {
  type: Partial<TProjectIssueType>;
  hierarchy?: TProjectIssueHierarchy;
  onConfigureHierarchy?: () => void;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onClosed: () => void;
  onSave: (data: Partial<TProjectIssueType>, id?: string) => Promise<TProjectIssueType | false>;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(type.name ?? "");
  const [level, setLevel] = useState(type.level ?? hierarchy?.default_level ?? 0);
  const [description, setDescription] = useState(type.description ?? "");
  const [logo, setLogo] = useState<Partial<TLogoProps>>((type.logo_props as TLogoProps) ?? {});
  const hasLogo = logo.in_use === "emoji" ? !!logo.emoji?.value : logo.in_use === "icon" && !!logo.icon?.name;
  const [pickerOpen, setPickerOpen] = useState(false);
  useLayoutEffect(() => {
    // Synchronize external Dialog presence before paint after committing the initial closed root.
    // eslint-disable-next-line react/set-state-in-effect
    setMounted(true);
  }, []);
  const submit = async () => {
    if (busy || !name.trim()) return;
    await onSave(
      { name: name.trim(), description, logo_props: logo, ...(!type.id || !hierarchy?.enabled ? { level } : {}) },
      type.id
    );
  };
  return (
    <Dialog
      open={mounted && open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>
                {t(type.id ? "web.workflow_ui.types_settings.edit" : "web.workflow_ui.types_settings.create")}
              </DialogTitle>
            </DialogHeading>
            <DialogCloseGroup>
              <IconButton
                size="md"
                variant="ghost"
                icon={<CloseOutline />}
                aria-label={t("close")}
                disabled={busy}
                onClick={onClose}
              />
            </DialogCloseGroup>
          </DialogHeader>
          <DialogBody>
            <form
              id="work-item-type-form"
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <InputField
                orientation="vertical"
                size="lg"
                label={t("name")}
                placeholder={t("web.workflow_ui.types_settings.name_placeholder")}
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
                startIcon={
                  <div className="-ml-2 flex shrink-0 items-center">
                    <EmojiPicker
                      isOpen={pickerOpen}
                      handleToggle={setPickerOpen}
                      disabled={busy}
                      iconType="lucide"
                      defaultOpen={logo.in_use ?? "icon"}
                      defaultIconColor={logo.icon?.color}
                      buttonClassName="flex size-6 shrink-0 items-center justify-center rounded-sm"
                      label={
                        <span
                          className="flex items-center justify-center"
                          aria-label={t("web.workflow_ui.types_settings.choose_icon")}
                        >
                          <TypesLogo type={{ ...type, logo_props: logo }} size={14} backgroundSize={20} />
                        </span>
                      }
                      onChange={(value) =>
                        setLogo(
                          value.type === "emoji"
                            ? { in_use: "emoji", emoji: { value: value.value as string } }
                            : { in_use: "icon", icon: value.value as TLogoProps["icon"] }
                        )
                      }
                    />
                    {hasLogo && (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        icon={<CloseOutline />}
                        aria-label={t("common.clear")}
                        disabled={busy}
                        onClick={() => {
                          setLogo({});
                          setPickerOpen(false);
                        }}
                      />
                    )}
                  </div>
                }
              />
              <label className="block space-y-2 text-body-xs-regular text-secondary">
                <span>{t("description")}</span>
                <TextAreaGroup resize="none" render={<div className="h-[96px]" />}>
                  <TextArea
                    size="lg"
                    surface="field"
                    aria-label={t("description")}
                    placeholder={t("web.workflow_ui.types_settings.description_placeholder")}
                    value={description}
                    disabled={busy}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </TextAreaGroup>
              </label>
              <TypeLevelField
                level={level}
                enabled={!!hierarchy?.enabled && !!type.id}
                levels={hierarchy?.levels}
                busy={busy}
                onChange={setLevel}
                onConfigure={onConfigureHierarchy}
              />
            </form>
          </DialogBody>
          <DialogActions>
            <Button
              stretch="auto"
              variant="secondary"
              size="md"
              disabled={busy}
              label={t("cancel")}
              onClick={onClose}
            />
            <Button
              stretch="auto"
              type="submit"
              form="work-item-type-form"
              variant="primary"
              size="md"
              disabled={busy || !name.trim()}
              label={t(type.id ? "save" : "web.workflow_ui.types_settings.add")}
            />
          </DialogActions>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}

const initialLevels = [0];
function TypeLevelField({
  level,
  enabled,
  levels = initialLevels,
  busy,
  onChange,
  onConfigure,
}: {
  level: number;
  enabled: boolean;
  levels?: number[];
  busy: boolean;
  onChange: (level: number) => void;
  onConfigure?: () => void;
}) {
  const { t } = useTranslation();
  if (enabled)
    return (
      <div className="space-y-2 text-body-xs-regular text-secondary">
        <p>{t("web.issue_hierarchy.central_hint", { level })}</p>
        <Button
          size="sm"
          variant="secondary"
          stretch="auto"
          disabled={busy}
          label={t("web.issue_hierarchy.configure")}
          onClick={onConfigure}
        />
      </div>
    );
  const items = [...new Set([0, ...levels, level])]
    // ES2023 Array.toSorted is outside the web TypeScript target.
    // eslint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: t("web.issue_hierarchy.level_label", { level: value }) }));
  return (
    <label className="block space-y-2 text-body-xs-regular text-secondary">
      <span>{t("web.issue_hierarchy.type_level")}</span>
      <Select
        items={items}
        value={String(level)}
        disabled={busy}
        onValueChange={(value) => {
          if (value !== null) onChange(Number(value));
        }}
      >
        <SelectTrigger size="lg" aria-label={t("web.issue_hierarchy.type_level")} />
        <SelectContent>
          <SelectList>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value} label={item.label} />
            ))}
          </SelectList>
        </SelectContent>
      </Select>
    </label>
  );
}
