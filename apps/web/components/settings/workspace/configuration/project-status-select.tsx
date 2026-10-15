import { ProjectStatusIcon } from "@/components/project/project-status-icon";
import { useState } from "react";
import { Select } from "@plane/blocks/select";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { useProject } from "@/hooks/store/use-project";
import type { ProjectCategory } from "@/services/workspace-configuration.service";
import { useProjectCategories } from "./project-fields";
const stateIcon = (state: ProjectCategory) => <ProjectStatusIcon group={state.group} color={state.color} />;
export function ProjectStatusSelect({
  workspaceSlug,
  projectId,
  value,
  disabled,
}: {
  workspaceSlug: string;
  projectId: string;
  value?: string | null;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { statuses, statesEnabled } = useProjectCategories(workspaceSlug);
  const { updateProject } = useProject();
  const [busy, setBusy] = useState(false);
  const selected =
    statuses.find((state) => state.id === value) ??
    (!value ? statuses.find((state) => state.is_default) : null) ??
    null;
  if (!statesEnabled) return null;
  return (
    <div
      role="presentation"
      className="flex max-w-full min-w-0 items-center"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Select<ProjectCategory>
        getValues={() => statuses}
        value={selected}
        disabled={disabled || busy}
        getOptionValue={(state) => state.id}
        getOptionLabel={(state) => state.name}
        getOptionIcon={stateIcon}
        searchPlaceholder={t("web.project_statuses")}
        showSearch
        pinSelected={false}
        onChange={async (id) => {
          if (typeof id !== "string" || busy) return;
          setBusy(true);
          try {
            await updateProject(workspaceSlug, projectId, { status: id });
          } catch {
            setToast({ type: "error", title: t("web.configuration_save_error") });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Select.Trigger variant="pill-md" className="max-w-full" tooltip aria-label={t("web.project_statuses")}>
          {selected && stateIcon(selected)}
          <span className="truncate">{selected?.name ?? t("web.no_project_status")}</span>
        </Select.Trigger>
      </Select>
    </div>
  );
}
