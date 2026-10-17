import { Select } from "@plane/blocks/select";
import { TemplatesOutline } from "@makeplane/propel/icons";
import { useState } from "react";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { workspaceConfigurationService as service, configurationKey } from "@/services/workspace-configuration.service";
import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";
import { ConfigurationSelect } from "./select";
import { isTemplateAvailable } from "./template-application";

type TemplatePickerProps = {
  workspaceSlug: string;
  kind: WorkspaceTemplate["kind"];
  onApply: (template: WorkspaceTemplate) => void;
  disabled?: boolean;
  projectId?: string;
  variant?: "inline" | "cover";
};

export function TemplatePicker(props: TemplatePickerProps) {
  return <TemplatePickerContent key={JSON.stringify([props.workspaceSlug, props.projectId, props.kind])} {...props} />;
}

function TemplatePickerContent({
  workspaceSlug,
  kind,
  onApply,
  disabled = false,
  projectId,
  variant = "inline",
}: TemplatePickerProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  const { data, error } = useSWR(workspaceSlug ? configurationKey(workspaceSlug, "templates") : null, () =>
    service.list<WorkspaceTemplate>(workspaceSlug, "templates")
  );
  const templates = data?.filter((entry) => isTemplateAvailable(entry, kind, projectId)) ?? [];
  const template = templates.find((entry) => entry.id === selected);
  if (variant === "cover") {
    return (
      <Select<WorkspaceTemplate>
        getValues={() => templates}
        value={template ?? null}
        onChange={(id) => {
          const chosen = templates.find((entry) => entry.id === id);
          if (chosen) {
            setSelected(chosen.id);
            onApply(chosen);
          }
        }}
        getOptionValue={(entry) => entry.id}
        getOptionLabel={(entry) => entry.name}
        disabled={disabled}
        placeholder={t("web.choose_template")}
        emptyMessage={error ? t("web.configuration_load_error") : t("web.no_project_templates")}
      >
        <Select.Trigger<WorkspaceTemplate>
          variant="icon-md"
          prependIcon={<TemplatesOutline />}
          aria-label={t("web.choose_template")}
          className="text-on-color hover:bg-white/10"
        />
      </Select>
    );
  }
  if (!templates.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-52">
        <ConfigurationSelect
          value={selected}
          disabled={disabled}
          onChange={setSelected}
          placeholder={t("web.choose_template")}
          options={templates.map((entry) => ({ value: entry.id, label: entry.name }))}
        />
      </div>
      <Button
        stretch="auto"
        size="sm"
        variant="secondary"
        disabled={!template || disabled}
        label={t("web.apply_template")}
        onClick={() => {
          if (template) onApply(template);
        }}
      />
      <span className="text-11 text-tertiary">{t("web.template_apply_hint")}</span>
    </div>
  );
}
