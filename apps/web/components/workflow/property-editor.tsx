import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InputField } from "@makeplane/propel/components/input-field";
import { CloseOutline } from "@makeplane/propel/icons";
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
import { useTranslation } from "@plane/i18n";
import { optionError } from "./property-editor.types";
import type { PropertyDraft, PropertyErrors } from "./property-editor.types";
export type { PropertyDraft } from "./property-editor.types";
import { PropertyConfiguration } from "./property-configuration";
import { PropertyDetails } from "./property-details";

function errorText(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return error.map(errorText).filter(Boolean).join(" ");
  if (error && typeof error === "object") return Object.values(error).map(errorText).filter(Boolean).join(" ");
  return undefined;
}
function saveErrors(error: unknown, label: (key: string) => string): PropertyErrors {
  const response = error && typeof error === "object" && "response" in error ? error.response : undefined;
  const data = response && typeof response === "object" && "data" in response ? response.data : error;
  if (!data || typeof data !== "object" || data instanceof Error) return {};
  if ("code" in data && data.code === "CUSTOM_PROPERTY_OPTIONS_CONFLICT") return { options: label("options_conflict") };
  return Object.fromEntries(
    ["name", "description", "property_type", "config", "options"].flatMap((key) => {
      const text = errorText((data as Record<string, unknown>)[key]);
      if (!text) return [];
      const message = text.includes("CUSTOM_PROPERTY_DUPLICATE_NAME")
        ? "merge.duplicate_name"
        : text.includes("CUSTOM_PROPERTY_DUPLICATE_OPTION")
          ? "option_duplicate"
          : text.includes("CUSTOM_PROPERTY_READ_ONLY_DEFAULT_REQUIRED")
            ? "read_only_default_required"
            : text.includes("CUSTOM_PROPERTY_TYPE_IMMUTABLE")
              ? "type_locked"
              : text.includes("CUSTOM_PROPERTY_CARDINALITY_IMMUTABLE")
                ? "multiple_locked"
                : key === "name"
                  ? "invalid_name"
                  : key === "options"
                    ? "invalid_options"
                    : text.includes("REFERENCE") || text.includes("VALUE")
                      ? "invalid_default"
                      : "invalid_config";
      return [[key, label(message)]];
    })
  );
}
function validDraft(value: PropertyDraft, typeSelected: boolean) {
  const readOnly = value.property_type === "text" && !!value.config.read_only;
  return (
    typeSelected &&
    !!value.name.trim() &&
    (!readOnly || !!String(value.config.default_value ?? "").trim()) &&
    (value.property_type !== "dropdown" || !(value.options ?? []).some((_, index) => optionError(value.options, index)))
  );
}
function requiredDisabledReason(value: PropertyDraft) {
  if (value.property_type === "boolean") return "required_boolean_reason";
  if (value.property_type === "text" && value.config.read_only) return "required_read_only_reason";
  return undefined;
}
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
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<PropertyErrors>({});
  const saving = useRef(false);
  useLayoutEffect(() => {
    // Open after the initial closed commit so Base UI runs the entrance animation.
    // eslint-disable-next-line react/set-state-in-effect
    setMounted(true);
  }, []);
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  const valid = validDraft(value, typeSelected);
  const updateValue: typeof setValue = (next) => {
    setErrors({});
    setValue(next);
  };
  const close = () => {
    if (!busy && !saving.current) onClose();
  };
  return (
    <Dialog
      open={mounted && open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      onOpenChangeComplete={onComplete}
    >
      <DialogContent size="md">
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitted(true);
            if (busy || saving.current || !valid) return;
            saving.current = true;
            setErrors({});
            try {
              await onSave({ ...value, name: value.name.trim() });
            } catch (error) {
              const fields = saveErrors(error, label);
              setErrors(Object.keys(fields).length ? fields : { form: label("save_failed") });
            } finally {
              saving.current = false;
            }
          }}
        >
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{label(value.id ? "edit_property" : "create_property")}</DialogTitle>
              </DialogHeading>
              <DialogCloseGroup>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t("close")}
                  icon={<CloseOutline className="size-4" />}
                  disabled={busy}
                  onClick={close}
                />
              </DialogCloseGroup>
            </DialogHeader>
            <DialogBody>
              <fieldset disabled={busy} className="space-y-5">
                <InputField
                  orientation="vertical"
                  size="lg"
                  label={label("name_label")}
                  placeholder={label("name_placeholder")}
                  // The first dialog field receives focus when the modal opens.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  required
                  maxLength={255}
                  value={value.name}
                  error={errors.name ?? (submitted && !value.name.trim() ? label("name_required") : undefined)}
                  onChange={(event) => updateValue((current) => ({ ...current, name: event.target.value }))}
                />
                <PropertyConfiguration
                  value={value}
                  setValue={updateValue}
                  busy={busy}
                  typeSelected={typeSelected}
                  onTypeSelected={() => setTypeSelected(true)}
                  errors={errors}
                  submitted={submitted}
                />
                <PropertyDetails
                  value={value}
                  setValue={updateValue}
                  busy={busy}
                  errors={errors}
                  requiredReason={requiredDisabledReason(value)}
                />
                {errors.form && (
                  <p role="alert" className="text-body-xs-regular text-danger-primary">
                    {errors.form}
                  </p>
                )}
              </fieldset>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button
              type="button"
              stretch="auto"
              variant="secondary"
              size="md"
              label={t("cancel")}
              disabled={busy}
              onClick={close}
            />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              type="submit"
              label={value.id ? t("save") : label("create")}
              disabled={busy || !typeSelected || !value.name.trim()}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
