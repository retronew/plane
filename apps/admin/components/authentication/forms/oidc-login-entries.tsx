import { Controller, useFieldArray, useWatch } from "react-hook-form";
import type { Control, FieldErrors } from "react-hook-form";
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Switch } from "@makeplane/propel/components/switch";
import { useTranslation } from "@plane/i18n";
import type { TInstanceOIDCAuthenticationConfigurationKeys, TOIDCLoginEntry } from "@plane/types";

export type OIDCConfigFormValues = Record<TInstanceOIDCAuthenticationConfigurationKeys, string> & {
  loginEntries: TOIDCLoginEntry[];
};

export function parseOIDCLoginEntries(value: string | undefined): TOIDCLoginEntry[] {
  if (!value) return [];
  try {
    const entries: unknown = JSON.parse(value);
    return Array.isArray(entries) ? (entries as TOIDCLoginEntry[]) : [];
  } catch {
    return [];
  }
}

export function OIDCLoginEntries({
  control,
  errors,
}: {
  control: Control<OIDCConfigFormValues>;
  errors: FieldErrors<OIDCConfigFormValues>;
}) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: "loginEntries", keyName: "formKey" });
  const loginEntries = useWatch({ control, name: "loginEntries" });
  const entryFields = [
    { key: "id", label: t("admin.authentication.oauth.oidc_entry_id"), placeholder: "moondrop", maxLength: 64 },
    { key: "name", label: t("admin.authentication.oauth.oidc_provider_name"), placeholder: "Moondrop", maxLength: 100 },
    {
      key: "provider_hint",
      label: t("admin.authentication.oauth.oidc_entry_provider"),
      placeholder: "provider-name",
      maxLength: 256,
    },
    {
      key: "icon_url",
      label: t("admin.authentication.oauth.oidc_provider_icon_url"),
      placeholder: "https://auth.example.com/logo.svg",
      maxLength: 2048,
    },
  ] as const;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="oidc-login-entries-heading">
      <div>
        <h4 id="oidc-login-entries-heading" className="text-14 font-medium">
          {t("admin.authentication.oauth.oidc_login_entries")}
        </h4>
        <p className="mt-1 text-11 text-tertiary">{t("admin.authentication.oauth.oidc_login_entries_description")}</p>
      </div>
      {fields.map((entry, index) => (
        <fieldset key={entry.formKey} className="flex min-w-0 flex-col gap-3 rounded-md border border-subtle p-3">
          <legend className="px-1 text-13 font-medium">
            {t("admin.authentication.oauth.oidc_entry_number", { number: index + 1 })}
          </legend>
          {entryFields.map(({ key, label, placeholder, maxLength }) => {
            const name = `loginEntries.${index}.${key}` as const;
            const error = errors.loginEntries?.[index]?.[key];
            return (
              <div key={key} className="flex flex-col gap-1">
                <label htmlFor={name} className="text-13 text-tertiary">
                  {label}
                </label>
                <InputGroup size="lg">
                  <Controller
                    control={control}
                    name={name}
                    rules={{
                      required: key !== "icon_url",
                      maxLength,
                      ...(key === "id"
                        ? {
                            pattern: /^[A-Za-z0-9_-]+$/,
                            validate: (value: string | undefined) =>
                              !loginEntries.some((item, itemIndex) => itemIndex !== index && item.id === value),
                          }
                        : {}),
                    }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        id={name}
                        size="lg"
                        placeholder={placeholder}
                        maxLength={maxLength}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${name}-error` : undefined}
                      />
                    )}
                  />
                </InputGroup>
                {error && (
                  <p id={`${name}-error`} className="text-11 text-danger-primary">
                    {t("admin.authentication.oauth.oidc_entry_field_invalid")}
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2">
            <Controller
              control={control}
              name={`loginEntries.${index}.enabled`}
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    size="sm"
                    aria-labelledby={`oidc-entry-enabled-${index}`}
                  />
                  <span id={`oidc-entry-enabled-${index}`} className="text-13 text-tertiary">
                    {t("admin.authentication.oauth.oidc_entry_enabled")}
                  </span>
                </div>
              )}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              stretch="auto"
              onClick={() => remove(index)}
              label={t("admin.authentication.oauth.oidc_entry_remove")}
              aria-label={t("admin.authentication.oauth.oidc_entry_remove_number", { number: index + 1 })}
            />
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        stretch="auto"
        disabled={fields.length >= 32}
        onClick={() => append({ id: "", name: "", provider_hint: "", icon_url: "", enabled: true })}
        label={t("admin.authentication.oauth.oidc_entry_add")}
      />
    </section>
  );
}
