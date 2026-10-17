import { useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InputField } from "@makeplane/propel/components/input-field";
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
import type { TLogoProps, TProjectIssueType, TProjectWorkflow, TWorkflowImpactRequest } from "@plane/types";

export function TypesEditor({
  type,
  open,
  busy,
  workflows,
  onClose,
  onClosed,
  onSave,
  onPreview,
}: {
  type: Partial<TProjectIssueType>;
  open: boolean;
  busy: boolean;
  workflows: TProjectWorkflow[];
  onClose: () => void;
  onClosed: () => void;
  onSave: (data: Partial<TProjectIssueType>, id?: string) => Promise<TProjectIssueType | false>;
  onPreview: (request: TWorkflowImpactRequest) => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(type.name ?? "");
  const [description, setDescription] = useState(type.description ?? "");
  const [logo, setLogo] = useState<TLogoProps>(
    (type.logo_props as TLogoProps) ?? { in_use: "icon", icon: { name: "circle", color: "#6d7b8a" } }
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState(type.workflow_id ?? "");
  useLayoutEffect(() => {
    // Synchronize external Dialog presence before paint after committing the initial closed root.
    // eslint-disable-next-line react/set-state-in-effect
    setMounted(true);
  }, []);
  const submit = async () => {
    if (busy || !name.trim()) return;
    const saved = await onSave({ name: name.trim(), description, logo_props: logo }, type.id);
    if (saved && type.id && workflowId !== (type.workflow_id ?? "")) {
      onPreview({ operation: "bind_type", type_id: saved.id, workflow_id: workflowId || undefined });
    }
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
                size="sm"
                variant="ghost"
                icon={<X className="size-4" />}
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
              <div className="flex items-center gap-3">
                <EmojiPicker
                  isOpen={pickerOpen}
                  handleToggle={setPickerOpen}
                  disabled={busy}
                  defaultOpen={logo.in_use}
                  defaultIconColor={logo.icon?.color}
                  buttonClassName="flex size-10 shrink-0 items-center justify-center rounded-md border border-subtle"
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
                  {type.id ? (
                    <InputField
                      orientation="vertical"
                      size="md"
                      label={t("name")}
                      value={name}
                      disabled={busy}
                      onChange={(event) => setName(event.target.value)}
                    />
                  ) : (
                    <input
                      aria-label={t("name")}
                      placeholder={t("web.workflow_ui.types_settings.name_placeholder")}
                      className="h-[22px] w-full border-0 bg-transparent text-body-sm-regular text-primary outline-none"
                      value={name}
                      disabled={busy}
                      onChange={(event) => setName(event.target.value)}
                    />
                  )}
                </div>
              </div>
              <label className="block space-y-2 text-body-xs-regular text-secondary">
                {type.id && <span>{t("description")}</span>}
                <textarea
                  aria-label={t("description")}
                  placeholder={t("web.workflow_ui.types_settings.description_placeholder")}
                  className="h-[76px] w-full resize-none border-0 bg-transparent text-body-sm-regular text-primary outline-none"
                  value={description}
                  disabled={busy}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              {type.id && (
                <label className="block space-y-2 text-body-xs-regular text-secondary">
                  <span>{t("common.workflows")}</span>
                  <select
                    className="w-full rounded-md border border-subtle bg-layer-1 p-2 text-primary"
                    value={workflowId}
                    disabled={busy}
                    onChange={(event) => setWorkflowId(event.target.value)}
                  >
                    <option value="">{t("web.workflow_ui.default_name")}</option>
                    {workflows
                      .filter((item) => !item.is_default)
                      .map((item) => (
                        <option key={item.id} value={item.workflow_id ?? item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                  <p>{t("web.workflow_ui.impact_warning")}</p>
                </label>
              )}
            </form>
          </DialogBody>
          <DialogActions>
            <Button stretch="auto" variant="ghost" size="md" disabled={busy} label={t("cancel")} onClick={onClose} />
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
