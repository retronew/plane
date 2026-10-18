import type { Dispatch, SetStateAction } from "react";
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import { Radio, RadioGroup } from "@makeplane/propel/components/radio";
import { InputField } from "@makeplane/propel/components/input-field";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { useTranslation } from "@plane/i18n";
import { PROPERTY_TYPES } from "./property-editor.types";
import { DropdownDefault } from "./property-dropdown-default";
import type { PropertyDraft } from "./property-editor.types";
type Props = { value: PropertyDraft; setValue: Dispatch<SetStateAction<PropertyDraft>>; busy: boolean };
export function PropertyConfiguration({
  value,
  setValue,
  busy,
  typeSelected = true,
  onTypeSelected,
}: Props & { typeSelected?: boolean; onTypeSelected?: () => void }) {
  const { t } = useTranslation();
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  return (
    <>
      <div className="space-y-2">
        <p className="text-body-xs-medium">{label("property_type")}</p>
        <Select
          items={PROPERTY_TYPES.map((type) => ({ value: type, label: label(`types.${type}`) }))}
          value={typeSelected ? value.property_type : null}
          disabled={!!value.id || busy}
          onValueChange={(next) => {
            if (next) {
              onTypeSelected?.();
              setValue({
                ...value,
                property_type: next as PropertyDraft["property_type"],
                config: {},
                is_required: next === "boolean" ? false : value.is_required,
              });
            }
          }}
        >
          <SelectTrigger
            size="lg"
            variant="secondary"
            placeholder={t("web.workflow_ui.select_type")}
            aria-label={label("property_type")}
          />
          <SelectContent>
            <SelectList>
              {PROPERTY_TYPES.map((type) => (
                <SelectItem key={type} value={type} label={label(`types.${type}`)} />
              ))}
            </SelectList>
          </SelectContent>
        </Select>
      </div>
      {typeSelected && <TypeConfiguration value={value} setValue={setValue} busy={busy} />}
    </>
  );
}

function TextConfiguration({ value, setValue }: Omit<Props, "busy">) {
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
        onValueChange={(format) =>
          setValue({
            ...value,
            config: {
              ...value.config,
              multiline: format === "paragraph",
              read_only: format === "read_only",
            },
            is_required: format === "read_only" ? false : value.is_required,
          })
        }
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

function DropdownConfiguration({ value, setValue }: Omit<Props, "busy">) {
  const { t } = useTranslation();
  const label = (key: string) => t(`web.work_item_properties.${key}`);
  return (
    <div className="space-y-2">
      <p className="text-body-xs-medium">{label("options")}</p>
      {(value.options ?? []).map((option, index) => (
        <div key={option.client_id} className="flex items-center gap-2">
          <InputField
            orientation="vertical"
            size="lg"
            aria-label={`${label("option_name")} ${index + 1}`}
            value={option.name}
            onChange={(event) =>
              setValue({
                ...value,
                options: value.options?.map((entry, position) =>
                  position === index ? { ...entry, name: event.target.value } : entry
                ),
              })
            }
          />
          <Button
            stretch="auto"
            size="sm"
            variant="ghost"
            label={t("remove")}
            onClick={() => setValue({ ...value, options: value.options?.filter((_, position) => position !== index) })}
          />
        </div>
      ))}
      <Button
        stretch="auto"
        size="sm"
        variant="ghost"
        label={label("add_option")}
        onClick={() =>
          setValue({
            ...value,
            options: [
              ...(value.options ?? []),
              { client_id: crypto.randomUUID(), name: "", sort_order: value.options?.length ?? 0 },
            ],
          })
        }
      />
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
    </div>
  );
}

function TypeConfiguration(props: Props) {
  const { value, setValue, busy } = props;
  switch (value.property_type) {
    case "text":
      return (
        <>
          <TextConfiguration value={value} setValue={setValue} />
          {Boolean(value.config.read_only) && <DefaultValueConfiguration value={value} setValue={setValue} />}
        </>
      );
    case "dropdown":
      return (
        <>
          <MultipleConfiguration {...props} />
          {value.id ? (
            <DropdownDefault value={value} setValue={setValue} busy={busy} />
          ) : (
            <DropdownConfiguration value={value} setValue={setValue} />
          )}
        </>
      );
    case "member":
      return <MultipleConfiguration {...props} />;
    case "number":
    case "boolean":
      return <DefaultValueConfiguration value={value} setValue={setValue} />;
    case "date":
      return <DateConfiguration value={value} setValue={setValue} />;
    default:
      return null;
  }
}
function MultipleConfiguration({ value, setValue, busy }: Props) {
  const { t } = useTranslation();
  return (
    <Checkbox
      label={t("web.work_item_properties.multiple")}
      disabled={busy || !!value.id}
      checked={!!value.config.multiple}
      onCheckedChange={(multiple) => setValue((current) => ({ ...current, config: { ...current.config, multiple } }))}
    />
  );
}
function DefaultValueConfiguration({ value, setValue }: Omit<Props, "busy">) {
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
      value={String(value.config.default_value ?? "")}
      onChange={(event) =>
        configure(readOnly ? event.target.value : event.target.value === "" ? null : Number(event.target.value))
      }
    />
  );
}
