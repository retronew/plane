import { useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectSeparator,
  SelectTrigger,
} from "@makeplane/propel/components/select";
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
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
import { useTranslation } from "@plane/i18n";

type Props = {
  value: number;
  onChange: (days: number) => Promise<void>;
  disabled?: boolean;
  label: string;
  maxDays?: number;
  allowCustom?: boolean;
};
export function AutomationDaysSelect({
  value,
  onChange,
  disabled = false,
  label,
  maxDays = 365,
  allowCustom = true,
}: Props) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(false),
    [draft, setDraft] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const presets = maxDays === 7 ? [1, 2, 3, 4, 5, 6, 7] : [7, 14, 30, 60, 90, 180, 365];
  const values = [...new Set([...presets, ...(value > 0 ? [value] : [])])].filter((days) => days <= maxDays);
  // The supported TypeScript lib predates toSorted; sort this newly owned array.
  // oxlint-disable-next-line unicorn/no-array-sort
  values.sort((a, b) => a - b);
  const options = values.map((days) => ({
    value: String(days),
    label: t("project_settings.automations.days", { count: days }),
  }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const days = Number(draft);
    if (!Number.isInteger(days) || days < 1 || days > maxDays) {
      setError(t("project_settings.automations.days_validation", { max: maxDays }));
      return;
    }
    if (saving || disabled) return;
    setSaving(true);
    setError("");
    try {
      await onChange(days);
      setCustom(false);
    } catch {
      setError(t("common.something_went_wrong"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="[&_button]:w-full [&_button]:min-w-0">
        <Select<string>
          disabled={disabled}
          value={String(value || values[0])}
          items={options}
          onValueChange={(next) => {
            if (next === "custom") {
              setDraft(String(value || 30));
              setError("");
              setCustom(true);
            } else if (next) void onChange(Number(next)).catch(() => undefined);
          }}
        >
          <SelectTrigger size="lg" width="fit" aria-label={label} />
          <SelectContent sizing="anchor-fixed">
            <SelectList>
              {options.map((option) => (
                <SelectItem key={option.value} {...option} />
              ))}
              {allowCustom && (
                <>
                  <SelectSeparator />
                  <SelectItem
                    value="custom"
                    label={t("project_settings.automations.custom_days")}
                    icon={<CalendarDays className="size-3.5" />}
                  />
                </>
              )}
            </SelectList>
          </SelectContent>
        </Select>
      </div>
      <Dialog
        open={custom}
        onOpenChange={(open) => {
          if (!saving) setCustom(open);
        }}
      >
        <DialogContent size="xs">
          <form onSubmit={submit} className="flex min-h-0 flex-col">
            <DialogMain>
              <DialogHeader>
                <DialogHeading>
                  <DialogTitle>{t("project_settings.automations.custom_days")}</DialogTitle>
                </DialogHeading>
              </DialogHeader>
              <DialogBody>
                <InputField
                  size="lg"
                  orientation="vertical"
                  type="number"
                  label={t("project_settings.automations.days_label")}
                  aria-label={t("project_settings.automations.days_label")}
                  value={draft}
                  disabled={saving}
                  min={1}
                  max={maxDays}
                  step={1}
                  endIcon={<span className="text-13 text-tertiary">{t("project_settings.automations.day_unit")}</span>}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError("");
                  }}
                  error={error || undefined}
                />
              </DialogBody>
            </DialogMain>
            <DialogActions>
              <Button
                variant="secondary"
                size="md"
                stretch="auto"
                label={t("common.cancel")}
                disabled={saving}
                onClick={() => setCustom(false)}
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                stretch="auto"
                label={t("save")}
                loading={saving}
                disabled={disabled}
              />
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
