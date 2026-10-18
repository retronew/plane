import { useLayoutEffect, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
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
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";

import type { PropertyDraft } from "./property-editor.types";
export type { PropertyDraft } from "./property-editor.types";
import { PropertyConfiguration } from "./property-configuration";
export function PropertyEditor({
  open,
  draft,
  busy,
  onClose,
  onComplete,
  onSave,
}: {
  open: boolean;
  draft: PropertyDraft;
  busy: boolean;
  onClose: () => void;
  onComplete: (open: boolean) => void;
  onSave: (draft: PropertyDraft) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(draft);
  const [typeSelected, setTypeSelected] = useState(Boolean(draft.id));
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    // Synchronize external Dialog presence before paint after the initial closed commit.
    // eslint-disable-next-line react/set-state-in-effect
    setMounted(true);
  }, []);
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  const readOnly = value.property_type === "text" && !!value.config.read_only;
  const valid = typeSelected && !!value.name.trim() && (!readOnly || !!String(value.config.default_value ?? "").trim());
  return (
    <Dialog
      open={mounted && open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      onOpenChangeComplete={onComplete}
    >
      <DialogContent size="md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && valid) void onSave({ ...value, name: value.name.trim() });
          }}
        >
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{label(value.id ? "edit_property" : "create_property")}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <fieldset disabled={busy} className="space-y-5">
                <InputField
                  orientation="vertical"
                  size="lg"
                  label={label("title")}
                  placeholder={label("title")}
                  required
                  maxLength={255}
                  value={value.name}
                  onChange={(event) => setValue({ ...value, name: event.target.value })}
                />
                <label className="flex flex-col gap-2 text-body-xs-medium">
                  {t("description")}
                  <TextAreaGroup resize="none" render={<div className="h-24" />}>
                    <TextArea
                      size="lg"
                      surface="field"
                      value={value.description}
                      onChange={(event) => setValue({ ...value, description: event.target.value })}
                    />
                  </TextAreaGroup>
                </label>
                <PropertyConfiguration
                  value={value}
                  setValue={setValue}
                  busy={busy}
                  typeSelected={typeSelected}
                  onTypeSelected={() => setTypeSelected(true)}
                />
              </fieldset>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <div className="mr-auto flex flex-wrap gap-4">
              <Checkbox
                disabled={busy}
                label={label("active")}
                checked={value.is_active}
                onCheckedChange={(checked) => setValue({ ...value, is_active: checked })}
              />
              <Checkbox
                disabled={busy || value.property_type === "boolean" || readOnly}
                label={label("required")}
                checked={value.is_required}
                onCheckedChange={(checked) => setValue({ ...value, is_required: checked })}
              />
            </div>
            <Button
              stretch="auto"
              variant="secondary"
              size="md"
              label={t("cancel")}
              disabled={busy}
              onClick={onClose}
            />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              type="submit"
              label={value.id ? t("save") : t("web.work_item_properties.create")}
              disabled={busy || !valid}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
