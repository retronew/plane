import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  BooleanOutline,
  CalendarOutline,
  DropdownOutline,
  HashOutline,
  LinkOutline,
  TextOutline,
  UserOutline,
} from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { Radio, RadioGroup } from "@makeplane/propel/components/radio";
import { InputField } from "@makeplane/propel/components/input-field";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { useTranslation } from "@plane/i18n";
import { PROPERTY_TYPES, optionError, optionKey } from "./property-editor.types";
import { DropdownDefault } from "./property-dropdown-default";
import type { PropertyDraft, PropertyErrors } from "./property-editor.types";
type Props = { value: PropertyDraft; setValue: Dispatch<SetStateAction<PropertyDraft>>; busy: boolean };
const NO_ERRORS: PropertyErrors = {};
export function PropertyConfiguration({
  value,
  setValue,
  busy,
  typeSelected = true,
  onTypeSelected,
  errors = NO_ERRORS,
  submitted = false,
}: Props & { typeSelected?: boolean; onTypeSelected?: () => void; errors?: PropertyErrors; submitted?: boolean }) {
  const drafts = useRef<Partial<Record<PropertyDraft["property_type"], PropertyDraft>>>({});
  const { t } = useTranslation();
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  return (
    <>
      <div className="space-y-2 [&>button]:w-full">
        <p className="text-body-xs-medium">{label("property_type")}</p>
        <Select
          items={PROPERTY_TYPES.map((type) => ({ value: type, label: label(`types.${type}`) }))}
          value={typeSelected ? value.property_type : null}
          disabled={!!value.id || busy}
          onValueChange={(next) => {
            if (next) {
              onTypeSelected?.();
              const type = next as PropertyDraft["property_type"];
              drafts.current[value.property_type] = value;
              const cached = drafts.current[type];
              setValue({
                ...value,
                property_type: type,
                config: cached?.config ?? {},
                options: cached?.options,
                is_required: type === "boolean" ? false : (cached?.is_required ?? value.is_required),
              });
            }
          }}
        >
          <SelectTrigger
            size="lg"
            variant="secondary"
            icon={typeSelected ? typeIcon(value.property_type) : undefined}
            placeholder={t("web.workflow_ui.select_type")}
            aria-label={label("property_type")}
          />
          <SelectContent>
            <SelectList>
              {PROPERTY_TYPES.map((type) => (
                <SelectItem
                  key={type}
                  value={type}
                  label={label(`types.${type}`)}
                  icon={typeIcon(type)}
                  description={label(`type_descriptions.${type}`)}
                />
              ))}
            </SelectList>
          </SelectContent>
        </Select>
        {value.id && <p className="text-body-xs-regular text-tertiary">{label("type_locked")}</p>}
        {errors.property_type && (
          <p role="alert" className="text-body-xs-regular text-danger-primary">
            {errors.property_type}
          </p>
        )}
      </div>
      {typeSelected && <TypeConfiguration value={value} setValue={setValue} busy={busy} submitted={submitted} />}
      {errors.config && (
        <p role="alert" className="text-body-xs-regular text-danger-primary">
          {errors.config}
        </p>
      )}
      {errors.options && (
        <p role="alert" className="text-body-xs-regular text-danger-primary">
          {errors.options}
        </p>
      )}
    </>
  );
}

const TYPE_ICONS = {
  text: TextOutline,
  number: HashOutline,
  dropdown: DropdownOutline,
  boolean: BooleanOutline,
  date: CalendarOutline,
  member: UserOutline,
  url: LinkOutline,
};
function typeIcon(type: PropertyDraft["property_type"]) {
  const Icon = TYPE_ICONS[type];
  return <Icon className="size-4" />;
}
function TextConfiguration({ value, setValue }: Omit<Props, "busy">) {
  const required = useRef(value.is_required);
  const { t } = useTranslation();
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  const readOnly = !!value.config.read_only;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-body-xs-medium">{label("text_format")}</legend>
      <RadioGroup
        name="text-format"
        aria-label={label("text_format")}
        density="compact"
        value={readOnly ? "read_only" : value.config.multiline ? "paragraph" : "single_line"}
        onValueChange={(format) => {
          if (format === "read_only" && !readOnly) required.current = value.is_required;
          setValue({
            ...value,
            config: {
              ...value.config,
              multiline: format === "paragraph",
              read_only: format === "read_only",
            },
            is_required: format === "read_only" ? false : readOnly ? required.current : value.is_required,
          });
        }}
      >
        {["single_line", "paragraph", "read_only"].map((format) => (
          <label key={format} className="flex items-center gap-2 text-body-xs-regular">
            <Radio value={format} />
            {label(format)}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function DropdownConfiguration({ value, setValue, busy }: Props) {
  const { t } = useTranslation();
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  const add = () =>
    setValue((current) => ({
      ...current,
      options: [
        ...(current.options ?? []),
        { client_id: crypto.randomUUID(), name: "", sort_order: current.options?.length ?? 0 },
      ],
    }));
  return (
    <div className="space-y-3">
      <p className="text-body-xs-medium">{label("options")}</p>
      {(value.options ?? []).map((option, index) => {
        const error = optionError(value.options, index);
        return (
          <div key={optionKey(option)} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <InputField
                orientation="vertical"
                size="lg"
                aria-label={`${label("option_name")} ${index + 1}`}
                value={option.name}
                error={error ? label(error) : undefined}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (!error) add();
                  }
                }}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    options: current.options?.map((entry, position) =>
                      position === index ? { ...entry, name: event.target.value } : entry
                    ),
                  }))
                }
              />
            </div>
            <Button
              type="button"
              stretch="auto"
              size="sm"
              variant="ghost"
              label={t("remove")}
              disabled={busy}
              onClick={() =>
                setValue((current) => {
                  const key = optionKey(option);
                  const selected = current.config.default_value;
                  return {
                    ...current,
                    options: current.options?.filter((_, position) => position !== index),
                    config: {
                      ...current.config,
                      ...(Array.isArray(selected)
                        ? { default_value: selected.filter((id) => id !== key) }
                        : selected === key
                          ? { default_value: null }
                          : {}),
                    },
                  };
                })
              }
            />
          </div>
        );
      })}
      <Button
        type="button"
        stretch="auto"
        size="sm"
        variant="ghost"
        label={label("add_option")}
        disabled={busy}
        onClick={add}
      />
      <DropdownDefault value={value} setValue={setValue} busy={busy} />
    </div>
  );
}

function DateConfiguration({ value, setValue }: Omit<Props, "busy">) {
  const { t } = useTranslation();
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  return (
    <div className="space-y-2">
      <p className="text-body-xs-medium">{label("date_format")}</p>
      <Select
        items={["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD/MM/YYYY"].map((format) => ({
          value: format,
          label: format,
        }))}
        value={String(value.config.format ?? "YYYY-MM-DD")}
        onValueChange={(format) => setValue((current) => ({ ...current, config: { ...current.config, format } }))}
      >
        <SelectTrigger size="lg" aria-label={label("date_format")} />
        <SelectContent>
          <SelectList>
            {["YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD/MM/YYYY"].map((format) => (
              <SelectItem key={format} value={format} label={format} />
            ))}
          </SelectList>
        </SelectContent>
      </Select>
      <p className="text-body-xs-regular text-tertiary">
        {t("web.work_item_properties.date_example", {
          value: (
            {
              "YYYY-MM-DD": "2026-10-18",
              "DD-MM-YYYY": "18-10-2026",
              "MM-DD-YYYY": "10-18-2026",
              "DD/MM/YYYY": "18/10/2026",
            } as Record<string, string>
          )[String(value.config.format ?? "YYYY-MM-DD")],
        })}
      </p>
    </div>
  );
}

function TypeConfiguration(props: Props & { submitted: boolean }) {
  const { value, setValue, submitted } = props;
  switch (value.property_type) {
    case "text":
      return (
        <>
          <TextConfiguration value={value} setValue={setValue} />
          {Boolean(value.config.read_only) && (
            <DefaultValueConfiguration value={value} setValue={setValue} submitted={submitted} />
          )}
        </>
      );
    case "dropdown":
      return (
        <>
          <MultipleConfiguration {...props} />
          <DropdownConfiguration {...props} />
        </>
      );
    case "member":
      return <MultipleConfiguration {...props} />;
    case "number":
    case "boolean":
      return <DefaultValueConfiguration value={value} setValue={setValue} submitted={submitted} />;
    case "date":
      return <DateConfiguration value={value} setValue={setValue} />;
    default:
      return null;
  }
}
function MultipleConfiguration({ value, setValue, busy }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Checkbox
        label={t("web.work_item_properties.multiple")}
        disabled={busy || !!value.id}
        checked={!!value.config.multiple}
        onCheckedChange={(multiple) =>
          setValue((current) => ({
            ...current,
            config: {
              ...current.config,
              multiple,
              default_value: multiple
                ? typeof current.config.default_value === "string"
                  ? [current.config.default_value]
                  : []
                : Array.isArray(current.config.default_value)
                  ? (current.config.default_value[0] ?? null)
                  : null,
            },
          }))
        }
      />
      {value.id && (
        <p className="text-body-xs-regular text-tertiary">{t("web.work_item_properties.multiple_locked")}</p>
      )}
    </div>
  );
}
function DefaultValueConfiguration({ value, setValue, submitted }: Omit<Props, "busy"> & { submitted: boolean }) {
  const { t } = useTranslation();
  const configure = (default_value: unknown) =>
    setValue((current) => ({ ...current, config: { ...current.config, default_value } }));
  if (value.property_type === "boolean")
    return (
      <Checkbox
        label={t("web.work_item_properties.default_value")}
        checked={!!value.config.default_value}
        onCheckedChange={configure}
      />
    );
  const readOnly = value.property_type === "text";
  return (
    <InputField
      orientation="vertical"
      size="lg"
      label={t("web.work_item_properties.default_value")}
      type={readOnly ? "text" : "number"}
      required={readOnly}
      error={
        submitted && readOnly && !String(value.config.default_value ?? "").trim()
          ? t("web.work_item_properties.read_only_default_required")
          : undefined
      }
      value={String(value.config.default_value ?? "")}
      onChange={(event) =>
        configure(readOnly ? event.target.value : event.target.value === "" ? null : Number(event.target.value))
      }
    />
  );
}
