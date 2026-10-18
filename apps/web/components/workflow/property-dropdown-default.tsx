import type { Dispatch, SetStateAction } from "react";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { useTranslation } from "@plane/i18n";
import { optionKey } from "./property-editor.types";
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
    (option) => option.name.trim() && option.is_active !== false && !option.is_archived
  );
  const selected = new Set(Array.isArray(value.config.default_value) ? value.config.default_value : []);
  const update = (defaultValue: string | string[] | null) =>
    setValue((current) => ({ ...current, config: { ...current.config, default_value: defaultValue } }));
  return (
    <div className="space-y-2 border-t border-subtle pt-3">
      <p className="text-body-xs-medium">{t("web.work_item_properties.default_value")}</p>
      {!options.length ? (
        <p className="text-body-xs-regular text-tertiary">{t("web.work_item_properties.options_empty_hint")}</p>
      ) : value.config.multiple ? (
        options.map((option) => (
          <Checkbox
            key={optionKey(option)}
            label={option.name}
            disabled={busy}
            checked={selected.has(optionKey(option))}
            onCheckedChange={(checked) =>
              update(
                checked ? [...selected, optionKey(option)] : [...selected].filter((id) => id !== optionKey(option))
              )
            }
          />
        ))
      ) : (
        <Select
          items={[
            { value: "", label: t("web.work_item_properties.empty") },
            ...options.map((option) => ({ value: optionKey(option), label: option.name })),
          ]}
          value={typeof value.config.default_value === "string" ? value.config.default_value : ""}
          disabled={busy}
          onValueChange={(next) => update(next || null)}
        >
          <SelectTrigger size="lg" aria-label={t("web.work_item_properties.default_value")} />
          <SelectContent>
            <SelectList>
              <SelectItem value="" label={t("web.work_item_properties.empty")} />
              {options.map((option) => (
                <SelectItem key={optionKey(option)} value={optionKey(option)} label={option.name} />
              ))}
            </SelectList>
          </SelectContent>
        </Select>
      )}
      <p className="text-body-xs-regular text-tertiary">{t("web.work_item_properties.default_empty_hint")}</p>
    </div>
  );
}
