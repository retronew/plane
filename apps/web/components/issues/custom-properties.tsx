import { useId, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Input } from "@makeplane/propel/components/input";
import { TextArea } from "@makeplane/propel/components/text-area";
import { Switch } from "@makeplane/propel/components/switch";
import { Button } from "@makeplane/propel/components/button";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { MemberSelect } from "@/components/dropdowns/member/member-select";
import { customPropertyErrors } from "@/helpers/custom-properties";
import { useWorkItemProperties } from "@/hooks/use-issue-properties";
import type {
  TCustomProperty,
  TCustomPropertyValue,
  TCustomPropertyValues,
} from "@/services/project/custom-properties.types";

type FieldProps = {
  property: TCustomProperty;
  value: TCustomPropertyValue | undefined;
  projectId: string;
  disabled?: boolean;
  error?: string;
  onChange?: (value: TCustomPropertyValue) => void;
  onSave?: (value: TCustomPropertyValue) => Promise<void>;
};

function CustomPropertyDropdown({
  property,
  draft,
  disabled,
  select,
}: {
  property: TCustomProperty;
  draft: TCustomPropertyValue;
  disabled: boolean;
  select: (value: TCustomPropertyValue) => void;
}) {
  const { t } = useTranslation();
  const selected = new Set(Array.isArray(draft) ? draft : [draft]);
  const options = [...property.options]
    // The TypeScript target lacks toSorted; the spread owns this array before sorting.
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((option) => option.is_active || selected.has(option.id));
  const items = options.map((option) => ({ value: option.id, label: option.name, disabled: !option.is_active }));
  return property.config.multiple ? (
    <Select<string, true>
      multiple
      items={items}
      value={Array.isArray(draft) ? draft : []}
      disabled={disabled}
      onValueChange={select}
    >
      <SelectTrigger aria-label={property.name} size="lg" width="fit" />
      <SelectContent>
        <SelectList>
          {items.map((item) => (
            <SelectItem key={item.value} {...item} />
          ))}
        </SelectList>
      </SelectContent>
    </Select>
  ) : (
    <Select<string>
      items={[{ value: "", label: t("web.work_item_properties.empty") }, ...items]}
      value={typeof draft === "string" ? draft : ""}
      disabled={disabled}
      onValueChange={(next) => select(next || null)}
    >
      <SelectTrigger aria-label={property.name} size="lg" width="fit" />
      <SelectContent>
        <SelectList>
          <SelectItem value="" label={t("web.work_item_properties.empty")} />
          {items.map((item) => (
            <SelectItem key={item.value} {...item} />
          ))}
        </SelectList>
      </SelectContent>
    </Select>
  );
}

function CustomPropertyInput({
  property,
  draft,
  inputProps,
  change,
}: {
  property: TCustomProperty;
  draft: TCustomPropertyValue;
  inputProps: { id: string; "aria-label": string; "aria-describedby"?: string; disabled: boolean; onBlur: () => void };
  change: (value: TCustomPropertyValue) => void;
}) {
  const types: Record<string, string> = { number: "number", date: "date", url: "url" };
  return (
    <Input
      size="lg"
      {...inputProps}
      type={types[property.property_type] ?? "text"}
      step={property.property_type === "number" ? "any" : undefined}
      value={typeof draft === "string" || typeof draft === "number" ? draft : ""}
      onChange={(event) =>
        change(
          event.target.value === ""
            ? null
            : property.property_type === "number"
              ? Number(event.target.value)
              : event.target.value
        )
      }
    />
  );
}

function CustomPropertyMember({
  property,
  draft,
  projectId,
  disabled,
  select,
}: {
  property: TCustomProperty;
  draft: TCustomPropertyValue;
  projectId: string;
  disabled: boolean;
  select: (value: TCustomPropertyValue) => void;
}) {
  return property.config.multiple ? (
    <MemberSelect
      multiple
      value={Array.isArray(draft) ? draft : []}
      projectId={projectId}
      disabled={disabled}
      variant="select-ghost-md"
      onChange={select}
    />
  ) : (
    <MemberSelect
      value={typeof draft === "string" ? draft : null}
      projectId={projectId}
      disabled={disabled}
      variant="select-ghost-md"
      clearable
      onChange={(next) => select(next || null)}
    />
  );
}

function CustomPropertyControl({
  property,
  draft,
  projectId,
  disabled,
  id,
  errorId,
  change,
  select,
  onBlur,
}: {
  property: TCustomProperty;
  draft: TCustomPropertyValue;
  projectId: string;
  disabled: boolean;
  id: string;
  errorId?: string;
  change: (value: TCustomPropertyValue) => void;
  select: (value: TCustomPropertyValue) => void;
  onBlur: () => void;
}) {
  const inputProps = { id, "aria-label": property.name, "aria-describedby": errorId, disabled, onBlur };
  let control;
  if (property.property_type === "boolean") {
    control = (
      <Switch
        size="md"
        id={id}
        aria-label={property.name}
        checked={draft === true}
        disabled={disabled}
        onCheckedChange={select}
      />
    );
  } else if (property.property_type === "member") {
    control = (
      <CustomPropertyMember
        property={property}
        draft={draft}
        projectId={projectId}
        disabled={disabled}
        select={select}
      />
    );
  } else if (property.property_type === "dropdown") {
    control = <CustomPropertyDropdown property={property} draft={draft} disabled={disabled} select={select} />;
  } else if (property.property_type === "text" && property.config.multiline) {
    control = (
      <TextArea
        size="lg"
        surface="field"
        {...inputProps}
        value={typeof draft === "string" ? draft : ""}
        onChange={(event) => change(event.target.value || null)}
      />
    );
  } else {
    control = <CustomPropertyInput property={property} draft={draft} inputProps={inputProps} change={change} />;
  }
  return control;
}

function CustomPropertyField({ property, value, projectId, disabled, error, onChange, onSave }: FieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const [localDraft, setDraft] = useState<{ value: TCustomPropertyValue }>();
  const draft = localDraft ? localDraft.value : (value ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const dirty = useRef(false);
  const readOnly = disabled || property.config.read_only;
  const change = (next: TCustomPropertyValue) => {
    dirty.current = true;
    setDraft({ value: next });
    setSaveError(undefined);
    onChange?.(next);
  };
  const commit = async (next: TCustomPropertyValue) => {
    if (readOnly || saving || !onSave) return;
    const validation = customPropertyErrors([property], { [property.id]: next })[property.id];
    if (validation) {
      setSaveError(validation);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      dirty.current = false;
      setDraft(undefined);
      setSaveError(undefined);
    } catch {
      setSaveError("save_failed");
      setToast({
        type: "error",
        title: t("web.work_item_properties.save_failed"),
        message: t("web.work_item_properties.retry_hint"),
      });
    } finally {
      setSaving(false);
    }
  };
  const select = (next: TCustomPropertyValue) => {
    change(next);
    void commit(next);
  };
  return (
    <div className="min-w-0 space-y-1.5" data-custom-property={property.id}>
      <label htmlFor={id} className="text-body-xs-medium text-secondary">
        {property.name}
        {(property.effective_is_required ?? property.is_required) && <span aria-hidden="true"> *</span>}
      </label>
      {property.description && <p className="text-caption-sm-regular text-tertiary">{property.description}</p>}
      <CustomPropertyControl
        property={property}
        draft={draft}
        projectId={projectId}
        disabled={!!readOnly || saving}
        id={id}
        errorId={error || saveError ? `${id}-error` : undefined}
        change={change}
        select={select}
        onBlur={() => {
          if (dirty.current) void commit(draft);
        }}
      />
      {(error || saveError) && (
        <p id={`${id}-error`} role="alert" className="text-caption-sm-regular text-danger-primary">
          {t(`web.work_item_properties.${error || saveError}`)}
        </p>
      )}
      {saveError === "save_failed" && (
        <Button
          stretch="auto"
          type="button"
          size="sm"
          variant="secondary"
          label={t("web.work_item_properties.retry")}
          onClick={() => void commit(draft)}
          disabled={saving}
        />
      )}
    </div>
  );
}

export function CustomPropertyFields({
  properties,
  values,
  projectId,
  disabled,
  errors,
  onChange,
  onSave,
}: {
  properties: TCustomProperty[];
  values: TCustomPropertyValues;
  projectId: string;
  disabled?: boolean;
  errors?: Record<string, string>;
  onChange?: (id: string, value: TCustomPropertyValue) => void;
  onSave?: (patch: TCustomPropertyValues) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {properties.map((property) => (
        <CustomPropertyField
          key={property.id}
          property={property}
          value={values[property.id]}
          projectId={projectId}
          disabled={disabled}
          error={errors?.[property.id]}
          onChange={onChange ? (value) => onChange(property.id, value) : undefined}
          onSave={onSave ? (value) => onSave({ [property.id]: value }) : undefined}
        />
      ))}
    </div>
  );
}

const IssueCustomPropertiesContent = observer(function IssueCustomPropertiesContent({
  workspaceSlug,
  projectId,
  issueId,
  disabled,
}: {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const properties = useWorkItemProperties(projectId, workspaceSlug, issueId);
  const [drafts, setDrafts] = useState<{ key: string; values: TCustomPropertyValues }>({ key: issueId, values: {} });
  const pending = drafts.key === issueId ? drafts.values : {};
  if (properties.error)
    return (
      <div role="alert" className="space-y-2">
        <p className="text-caption-sm-regular text-danger-primary">{t("web.work_item_properties.load_failed")}</p>
        <Button
          stretch="auto"
          size="sm"
          variant="secondary"
          label={t("web.work_item_properties.retry")}
          onClick={() => void properties.retry()}
        />
      </div>
    );
  if (properties.isLoading)
    return <output className="text-caption-sm-regular text-tertiary">{t("web.work_item_properties.loading")}</output>;
  return (
    <CustomPropertyFields
      key={`${projectId}:${issueId}`}
      properties={properties.properties}
      values={{ ...properties.values, ...pending }}
      projectId={projectId}
      disabled={disabled}
      onChange={(id, value) =>
        setDrafts((current) => ({
          key: issueId,
          values: { ...(current.key === issueId ? current.values : {}), [id]: value },
        }))
      }
      onSave={async (patch) => {
        await properties.save(patch);
        setDrafts((current) => {
          if (current.key !== issueId) return current;
          const remaining = { ...current.values };
          for (const id of Object.keys(patch))
            if (JSON.stringify(remaining[id]) === JSON.stringify(patch[id])) delete remaining[id];
          return { key: issueId, values: remaining };
        });
      }}
    />
  );
});

export function IssueCustomProperties(props: {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
}) {
  return <IssueCustomPropertiesContent {...props} />;
}
