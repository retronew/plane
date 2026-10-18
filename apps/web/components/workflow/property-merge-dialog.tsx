import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { CloseOutline } from "@makeplane/propel/icons";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogClose,
  DialogCloseGroup,
  DialogDescription,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { InputField } from "@makeplane/propel/components/input-field";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { useTranslation } from "@plane/i18n";
import type {
  TCustomProperty,
  TCustomPropertyMergeInput,
  TCustomPropertyMergePreview,
} from "@/services/project/custom-properties.service";

export type PropertyMergeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: TCustomProperty[];
  busy?: boolean;
  onPreview: (ids: string[]) => Promise<TCustomPropertyMergePreview>;
  onMerge: (payload: TCustomPropertyMergeInput) => Promise<boolean>;
};

function mergeErrorKey(error: unknown): string {
  const data = (error as { response?: { data?: { code?: string } }; code?: string } | null)?.response?.data;
  const code = String(data?.code ?? (error as { code?: string } | null)?.code ?? "").toLowerCase();
  if (code.includes("overlap") || code.includes("binding")) return "overlap";
  if (code.includes("config") || code.includes("incompatible") || code.includes("mismatch")) return "incompatible";
  if (code.includes("value_conflict")) return "value_conflict";
  if (code.includes("default_conflict")) return "default_conflict";
  if (code.includes("option_conflict")) return "option_conflict";
  if (code.includes("duplicate_name")) return "duplicate_name";
  if (code.includes("invalid_sources")) return "invalid_sources";
  return "failed";
}

export function PropertyMergeDialog({
  open,
  onOpenChange,
  properties,
  busy = false,
  onPreview,
  onMerge,
}: PropertyMergeDialogProps) {
  const { t } = useTranslation();
  const label = (key: string) => t(`web.work_item_properties.merge.${key}`);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [group, setGroup] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState<TCustomPropertyMergePreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const locked = busy || pending;
  useLayoutEffect(() => {
    // Commit the closed Dialog before opening so its entry transition runs even on first mount.
    // eslint-disable-next-line react/set-state-in-effect
    setMounted(true);
  }, []);

  const grouped = new Map<string, TCustomProperty[]>();
  for (const property of properties) {
    const key = `${property.property_type}:${Boolean(property.config.multiple)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), property]);
  }
  const groups = [...grouped.entries()].filter(([, entries]) => entries.length >= 2);
  const candidates = grouped.get(group ?? "") ?? [];
  const selectedIds = new Set(ids);
  const selected = candidates.filter((property) => selectedIds.has(property.id));
  const bindings = selected.flatMap((property) => [
    ...new Set(property.type_settings.map((setting) => setting.project_issue_type_id || setting.type_id)),
  ]);
  const overlap = new Set(bindings).size < bindings.length;
  const validSelection = selected.length >= 2 && selected.length === ids.length && !overlap;
  const validName = Boolean(name.trim());
  const confirmed = validName && confirmation === label("confirmation_word");
  const groupItems = groups.map(([value, entries]) => ({
    value,
    label: `${t(`web.work_item_properties.types.${entries[0].property_type}`)}${entries[0].property_type === "dropdown" || entries[0].property_type === "member" ? ` · ${label(entries[0].config.multiple ? "multiple" : "single")}` : ""}`,
  }));

  function reset() {
    setStep(0);
    setGroup(null);
    setIds([]);
    setName("");
    setDescription("");
    setConfirmation("");
    setPreview(null);
    setError(null);
  }

  async function advance() {
    if (locked || inFlight.current) return;
    if (step === 0) {
      if (groups.some(([key]) => key === group)) setStep(1);
      return;
    }
    if (!validSelection || (step === 2 && (!confirmed || !preview))) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      if (step === 1) {
        const result = await onPreview(ids);
        setPreview(result);
        setStep(2);
      } else {
        const success = await onMerge({ source_property_ids: ids, name: name.trim(), description });
        if (success) onOpenChange(false);
        else setError("failed");
      }
    } catch (cause) {
      setError(mergeErrorKey(cause));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog
      open={mounted && open}
      onOpenChange={(next, details) => {
        if (locked || inFlight.current) {
          details.cancel();
          return;
        }
        onOpenChange(next);
      }}
      onOpenChangeComplete={(next) => {
        if (!next) reset();
      }}
    >
      <DialogContent size="md">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void advance();
          }}
        >
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{label("title")}</DialogTitle>
                <DialogDescription>{label("subtitle")}</DialogDescription>
              </DialogHeading>
              <DialogCloseGroup>
                <IconButton
                  size="md"
                  variant="ghost"
                  icon={<CloseOutline />}
                  aria-label={t("close")}
                  disabled={locked}
                  render={<DialogClose />}
                />
              </DialogCloseGroup>
            </DialogHeader>
            <DialogBody>
              <fieldset disabled={locked} className="space-y-4" aria-busy={locked}>
                <p className="text-body-sm-medium">{label(["choose_type", "choose_properties", "confirm"][step])}</p>
                {step === 0 && (
                  <>
                    <p className="text-body-xs-regular text-tertiary">{label("type_hint")}</p>
                    <Select
                      items={groupItems}
                      value={group}
                      disabled={locked}
                      onValueChange={(value) => {
                        setGroup(value);
                        setIds([]);
                        setPreview(null);
                        setError(null);
                      }}
                    >
                      <SelectTrigger
                        size="lg"
                        variant="secondary"
                        aria-label={t("web.work_item_properties.property_type")}
                        placeholder={label("choose_type")}
                      />
                      <SelectContent>
                        <SelectList>
                          {groupItems.map((item) => (
                            <SelectItem key={item.value} value={item.value} label={item.label} />
                          ))}
                        </SelectList>
                      </SelectContent>
                    </Select>
                    {groups.length === 0 && (
                      <output className="text-body-xs-regular text-tertiary">{label("none_available")}</output>
                    )}
                  </>
                )}
                {step === 1 && (
                  <>
                    <p className="text-body-xs-regular text-tertiary">{label("selection_hint")}</p>
                    <div className="max-h-64 space-y-3 overflow-y-auto">
                      {candidates.map((property) => (
                        <div key={property.id} className="space-y-1">
                          <Checkbox
                            label={property.name}
                            checked={selectedIds.has(property.id)}
                            disabled={locked}
                            onCheckedChange={(checked) => {
                              setIds(checked ? [...ids, property.id] : ids.filter((id) => id !== property.id));
                              setPreview(null);
                              setError(null);
                            }}
                          />
                          {property.description && (
                            <p className="pl-6 text-body-xs-regular text-tertiary">{property.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <p className="text-body-xs-regular text-tertiary">{label("summary_hint")}</p>
                    <ul className="space-y-1 text-body-xs-regular">
                      <li>{t("web.work_item_properties.merge.property_count", { count: selected.length })}</li>
                      <li>
                        {t("web.work_item_properties.merge.work_items_count", {
                          count: preview?.work_items_count ?? 0,
                        })}
                      </li>
                      <li>{t("web.work_item_properties.merge.draft_count", { count: preview?.draft_count ?? 0 })}</li>
                      <li>{t("web.work_item_properties.merge.type_count", { count: preview?.type_count ?? 0 })}</li>
                    </ul>
                    <InputField
                      orientation="vertical"
                      size="lg"
                      label={t("web.work_item_properties.title")}
                      required
                      maxLength={255}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                    <label className="flex flex-col gap-2 text-body-xs-medium">
                      {t("description")}
                      <TextAreaGroup resize="none" render={<div className="h-24" />}>
                        <TextArea
                          size="lg"
                          surface="field"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                        />
                      </TextAreaGroup>
                    </label>
                    <InputField
                      orientation="vertical"
                      size="lg"
                      label={label("confirmation")}
                      description={label("confirmation_hint")}
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      autoComplete="off"
                    />
                  </>
                )}
                {(overlap || error) && (
                  <p role="alert" className="text-body-xs-regular text-danger-primary">
                    {label(overlap ? "overlap" : error!)}
                  </p>
                )}
              </fieldset>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            {step > 0 && (
              <Button
                stretch="auto"
                variant="secondary"
                size="md"
                label={t("common.back")}
                disabled={locked}
                onClick={() => {
                  setStep(step - 1);
                  setError(null);
                }}
              />
            )}
            <Button
              stretch="auto"
              variant="secondary"
              size="md"
              label={t("cancel")}
              disabled={locked}
              onClick={() => {
                if (!inFlight.current && !busy) onOpenChange(false);
              }}
            />
            <Button
              stretch="auto"
              variant="primary"
              size="md"
              type="submit"
              label={label(step === 2 ? "action" : "continue")}
              disabled={
                locked ||
                (step === 0
                  ? !groups.some(([key]) => key === group)
                  : step === 1
                    ? !validSelection
                    : !validSelection || !confirmed || !preview)
              }
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
