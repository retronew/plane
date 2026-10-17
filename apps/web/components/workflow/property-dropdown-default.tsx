import type { Dispatch, SetStateAction } from "react";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { useTranslation } from "@plane/i18n";
import type { PropertyDraft } from "./property-editor.types";

export function DropdownDefault({
  value,
  setValue,
  busy,
}: {
  value: PropertyDraft;
  setValue: Dispatch<SetStateAction<PropertyDraft>>;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const options = (value.options ?? []).filter(
    (option): option is typeof option & { id: string } => !!option.id && option.is_active !== false
  );
  const selected = new Set(Array.isArray(value.config.default_value) ? value.config.default_value : []);
  const update = (defaultValue: string | string[] | null) =>
    setValue((current) => ({ ...current, config: { ...current.config, default_value: defaultValue } }));
  return (
    <div className="space-y-2">
      <p className="text-body-xs-medium">{t("web.work_item_properties.default_value")}</p>
      {value.config.multiple ? (
        options.map((option) => (
          <Checkbox
            key={option.id}
            label={option.name}
            disabled={busy}
            checked={selected.has(option.id)}
            onCheckedChange={(checked) =>
              update(checked ? [...selected, option.id] : [...selected].filter((id) => id !== option.id))
            }
          />
        ))
      ) : (
        <Select
          items={[
            { value: "", label: t("web.work_item_properties.empty") },
            ...options.map((option) => ({ value: option.id, label: option.name })),
          ]}
          value={typeof value.config.default_value === "string" ? value.config.default_value : ""}
          disabled={busy}
          onValueChange={(next) => update(next || null)}
        >
          <SelectTrigger size="md" aria-label={t("web.work_item_properties.default_value")} />
          <SelectContent>
            <SelectList>
              <SelectItem value="" label={t("web.work_item_properties.empty")} />
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id} label={option.name} />
              ))}
            </SelectList>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
