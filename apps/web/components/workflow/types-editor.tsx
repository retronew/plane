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
import { EmojiPicker, Logo } from "@plane/blocks/emoji-icon-picker";
import { useTranslation } from "@plane/i18n";
import type { TLogoProps, TProjectIssueType } from "@plane/types";

export function TypesEditor({
  type,
  open,
  busy,
  onClose,
  onClosed,
  onSave,
}: {
  type: Partial<TProjectIssueType>;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onClosed: () => void;
  onSave: (data: Partial<TProjectIssueType>, id?: string) => Promise<TProjectIssueType | false>;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(type.name ?? "");
  const [description, setDescription] = useState(type.description ?? "");
  const [logo, setLogo] = useState<TLogoProps>(
    (type.logo_props as TLogoProps) ?? { in_use: "icon", icon: { name: "circle", color: "#6d7b8a" } }
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  useLayoutEffect(() => {
    // Synchronize external Dialog presence before paint after committing the initial closed root.
    // eslint-disable-next-line react/set-state-in-effect
    setMounted(true);
  }, []);
  const submit = async () => {
    if (busy || !name.trim()) return;
    await onSave({ name: name.trim(), description, logo_props: logo }, type.id);
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
              <div className="flex items-end gap-3">
                <EmojiPicker
                  isOpen={pickerOpen}
                  handleToggle={setPickerOpen}
                  disabled={busy}
                  defaultOpen={logo.in_use}
                  defaultIconColor={logo.icon?.color}
                  buttonClassName="flex size-8 shrink-0 items-center justify-center rounded-md border border-subtle"
                  label={
                    <span aria-label={t("web.workflow_ui.types_settings.choose_icon")}>
                      <Logo logo={logo} size={20} />
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
                <div className="min-w-0 flex-1">
                  <InputField
                    orientation="vertical"
                    size="lg"
                    label={t("name")}
                    placeholder={t("web.workflow_ui.types_settings.name_placeholder")}
                    value={name}
                    disabled={busy}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              </div>
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
