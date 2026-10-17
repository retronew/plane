import { observer } from "mobx-react";
import { Shapes } from "lucide-react";
import { Select } from "@plane/blocks/select";
import type { SelectVariant } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType } from "@plane/types";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";

export const IssueTypeSelect = observer(function IssueTypeSelect({
  projectId,
  value,
  onChange,
  variant = "pill-md",
  disabled,
}: {
  projectId?: string | null;
  value?: string | null;
  onChange: (id: string | null) => void;
  variant?: SelectVariant;
  disabled?: boolean;
}) {
  const store = useProjectWorkflow(projectId ?? undefined),
    { t } = useTranslation();
  const types = store.issueTypes[projectId ?? ""]?.results.filter((type) => type.is_active) ?? [];
  const placeholder = t(value === null ? "web.workflow_ui.no_type" : "web.workflow_ui.select_type");
  const selected =
    types.find((type) => type.id === value) ??
    (value === undefined ? types.find((type) => type.is_default) : undefined);
  return (
    <Select<TProjectIssueType>
      getValues={() => types}
      value={selected ?? null}
      onChange={(id) => onChange(id || null)}
      getOptionValue={(type) => type.id}
      getOptionLabel={(type) => type.name}
      disabled={disabled || !types.length}
      placeholder={placeholder}
    >
      <Select.Trigger<TProjectIssueType>
        variant={variant}
        disabled={disabled || !types.length}
        data-testid="work-item-type-select"
        prependIcon={<Shapes className="size-4" />}
        label={(values) => values[0]?.name ?? placeholder}
      >
        {(values) => <span className="min-w-0 grow truncate text-left">{values[0]?.name ?? placeholder}</span>}
      </Select.Trigger>
    </Select>
  );
});
