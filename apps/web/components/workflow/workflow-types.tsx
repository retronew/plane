import { useState } from "react";
import { observer } from "mobx-react";
import { Select } from "@plane/blocks/select";
import { cn } from "@plane/utils";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueType, TProjectWorkflow, TWorkflowImpact, TWorkflowImpactRequest } from "@plane/types";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { getWorkflowErrorCode } from "@/helpers/workflow";
import { TypesLogo } from "./types-logo";
import { WorkflowImpactDialog } from "./impact-dialog";

const typeIcon = (type: TProjectIssueType) => <TypesLogo type={type} size={14} backgroundSize={20} />;
const typeChip = (type: TProjectIssueType) => (
  <>
    {typeIcon(type)}
    <span className="truncate">{type.name}</span>
  </>
);

/** Manage the types governed by this workflow from its detail page. */
export const WorkflowTypes = observer(function WorkflowTypes({
  workflow,
  projectId,
  workspaceSlug,
  disabled,
}: {
  workflow: TProjectWorkflow;
  projectId: string;
  workspaceSlug: string;
  disabled: boolean;
}) {
  const store = useProjectWorkflow(projectId);
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [impact, setImpact] = useState<{ request: TWorkflowImpactRequest; preview: TWorkflowImpact } | null>(null);
  const [impactOpen, setImpactOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const types = store.issueTypes[projectId]?.results ?? [];
  const id = workflow.workflow_id ?? workflow.id;
  const isDefault = Boolean(workflow.is_default || workflow.id === "default");
  const belongs = (workflowId: string | null) => workflowId === id || (isDefault && !workflowId);
  const selected = types.filter((type) => belongs(type.workflow_id));
  const options = types.filter((type) => type.is_active || belongs(type.workflow_id));
  const locked = disabled || busy || !workflow.can_manage;
  const bind = async (typeId: string, remove = false) => {
    if (locked || (remove && isDefault)) return;
    setPickerOpen(false);
    setBusy(true);
    const request: TWorkflowImpactRequest = {
      operation: "bind_type",
      type_id: typeId,
      // An unbound type uses the default workflow; removing a binding restores that fallback.
      workflow_id: remove || isDefault ? undefined : id,
    };
    try {
      const preview = await store.service.preview(workspaceSlug, projectId, request);
      setImpact({ request, preview });
      setImpactOpen(true);
    } catch (error) {
      const code = getWorkflowErrorCode(error);
      setToast({
        type: "error",
        title: t("error"),
        message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed"),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="mt-6 space-y-2"
      aria-label={t("web.workflow_ui.issue_types")}
      onFocusCapture={(event) => {
        if (!locked && !impactOpen && event.target.id === `workflow-types-${id}`) setPickerOpen(true);
      }}
    >
      <label htmlFor={`workflow-types-${id}`} className="block text-body-xs-medium text-primary">
        {t("web.workflow_ui.issue_types")}
      </label>
      <Select<TProjectIssueType>
        multiple
        getValues={() => options}
        value={selected}
        getOptionValue={(type) => type.id}
        getOptionLabel={(type) => type.name}
        getOptionIcon={typeIcon}
        getOptionDisabled={(type) => isDefault && belongs(type.workflow_id)}
        getOptionTooltip={(type) =>
          isDefault && belongs(type.workflow_id) ? t("web.workflow_ui.unbound_types") : undefined
        }
        renderChip={typeChip}
        searchPlaceholder=""
        showSearch={false}
        contentSizing="anchor"
        disabled={locked}
        open={pickerOpen && !impactOpen}
        onOpenChange={setPickerOpen}
        onChange={(ids) => {
          const selectedIds = new Set(selected.map((type) => type.id));
          const added = ids.find((typeId) => !selectedIds.has(typeId));
          const removed = selected.find((type) => !ids.includes(type.id));
          if (added) void bind(added);
          else if (removed) void bind(removed.id, true);
        }}
      >
        <Select.Trigger<TProjectIssueType>
          id={`workflow-types-${id}`}
          variant="search-input"
          className={cn("min-h-10 w-full bg-layer-2", isDefault && "[&_button]:hidden")}
          data-testid="workflow-types-picker"
        />
      </Select>
      {impact && (
        <WorkflowImpactDialog
          request={impact.request}
          impact={impact.preview}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          open={impactOpen}
          onClose={() => setImpactOpen(false)}
          onApplied={() => setImpactOpen(false)}
          onOpenChangeComplete={(open) => {
            if (!open) setImpact(null);
          }}
        />
      )}
    </section>
  );
});
