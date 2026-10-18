import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { Switch } from "@makeplane/propel/components/switch";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { TextOutline, SettingsOutline } from "@makeplane/propel/icons";
import { useTranslation } from "@plane/i18n";
import type { PropertyDraft, PropertyErrors } from "./property-editor.types";

export function PropertyDetails({
  value,
  setValue,
  busy,
  errors,
  requiredReason,
}: {
  value: PropertyDraft;
  setValue: Dispatch<SetStateAction<PropertyDraft>>;
  busy: boolean;
  errors: PropertyErrors;
  requiredReason?: string;
}) {
  const { t } = useTranslation();
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  const [descriptionOpen, setDescriptionOpen] = useState(Boolean(value.description));
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
      <Collapsible
        open={descriptionOpen}
        onOpenChange={setDescriptionOpen}
        disabled={busy}
        icon={<TextOutline className="size-4" />}
        trigger={
          <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span>{descriptionOpen || value.description ? t("description") : label("add_description")}</span>
            {!descriptionOpen && value.description && (
              <span className="min-w-0 flex-1 truncate text-body-xs-regular text-tertiary">{value.description}</span>
            )}
          </span>
        }
        render={
          <div className="rounded-lg border border-subtle bg-surface-1 [&_[data-slot=disclosure-indicator]]:ml-auto [&_button[aria-expanded]>span:not([data-slot])]:flex-1" />
        }
      >
        <label className="mt-3 flex flex-col gap-2">
          <span className="sr-only">{t("description")}</span>
          <TextAreaGroup resize="none" render={<div className="h-20" />}>
            <TextArea
              size="lg"
              surface="field"
              value={value.description}
              placeholder={label("description_placeholder")}
              onChange={(event) => setValue((current) => ({ ...current, description: event.target.value }))}
            />
          </TextAreaGroup>
          {errors.description && (
            <span role="alert" className="text-danger-primary">
              {errors.description}
            </span>
          )}
        </label>
      </Collapsible>
      <Collapsible
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        disabled={busy}
        icon={<SettingsOutline className="size-4" />}
        trigger={
          <span className="flex flex-1 items-center justify-between gap-3 text-left">
            <span>{label("more_settings")}</span>
            {!settingsOpen && (
              <span className="text-body-xs-regular text-tertiary">
                {label(value.is_active ? "active_summary" : "inactive_summary")} ·{" "}
                {label(value.is_required ? "required" : "optional")}
              </span>
            )}
          </span>
        }
        render={
          <div className="rounded-lg border border-subtle bg-surface-1 [&_[data-slot=disclosure-indicator]]:ml-auto [&_button[aria-expanded]>span:not([data-slot])]:flex-1" />
        }
      >
        <div className="divide-y divide-subtle">
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-body-xs-medium">{label("active")}</p>
              <p className="mt-1 text-body-xs-regular text-tertiary">{label("active_hint")}</p>
            </div>
            <Switch
              size="sm"
              aria-label={label("active")}
              disabled={busy}
              checked={value.is_active}
              onCheckedChange={(checked) => setValue((current) => ({ ...current, is_active: checked }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-body-xs-medium">{label("required")}</p>
              <p className="mt-1 text-body-xs-regular text-tertiary">{label(requiredReason ?? "required_hint")}</p>
            </div>
            <Switch
              size="sm"
              aria-label={label("required")}
              disabled={busy || !!requiredReason}
              checked={value.is_required}
              onCheckedChange={(checked) => setValue((current) => ({ ...current, is_required: checked }))}
            />
          </div>
        </div>
      </Collapsible>
    </>
  );
}
