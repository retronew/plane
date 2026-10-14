import { useState } from "react";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { workspaceConfigurationService as service, configurationKey } from "@/services/workspace-configuration.service";
import type { WorkspaceTemplate } from "@/services/workspace-configuration.service";
import { ConfigurationSelect } from "./select";

export function TemplatePicker({
  workspaceSlug,
  kind,
  onApply,
  disabled = false,
  projectId,
}: {
  workspaceSlug: string;
  kind: WorkspaceTemplate["kind"];
  onApply: (template: WorkspaceTemplate) => void;
  disabled?: boolean;
  projectId?: string;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  const { data } = useSWR(workspaceSlug ? configurationKey(workspaceSlug, "templates") : null, () =>
    service.list<WorkspaceTemplate>(workspaceSlug, "templates")
  );
  const templates =
    data?.filter((entry) => entry.kind === kind && (!entry.project || entry.project === projectId)) ?? [];
  const template = templates.find((entry) => entry.id === selected);
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
