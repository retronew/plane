import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { TProjectIssueHierarchy, TProjectIssueType } from "@plane/types";
import { getWorkflowErrorCode } from "@/helpers/workflow";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { TypesEditor } from "./types-editor";

/** Reuse the project type editor without leaving the workflow list. */
export function WorkflowCreateTypeAction({
  workspaceSlug,
  projectId,
  disabled,
}: {
  workspaceSlug: string;
  projectId: string;
  disabled: boolean;
}) {
  const store = useProjectWorkflow(projectId);
  const { t } = useTranslation();
  const [hierarchy, setHierarchy] = useState<TProjectIssueHierarchy | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reportError = (error: unknown) => {
    const code = getWorkflowErrorCode(error);
    setToast({
      type: "error",
      title: t("error"),
      message: code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed"),
    });
  };
  const create = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const config = await store.service.hierarchy(workspaceSlug, projectId);
      setHierarchy(config);
      setOpen(true);
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  };
  const save = async (data: Partial<TProjectIssueType>): Promise<TProjectIssueType | false> => {
    if (busy || disabled) return false;
    setBusy(true);
    try {
      const saved = await store.service.saveType(workspaceSlug, projectId, data);
      // Close after the successful write, even if refreshing the list fails, to avoid duplicate creates.
      setOpen(false);
      try {
        await store.refresh(workspaceSlug, projectId);
      } catch {
        setToast({ type: "error", title: t("error"), message: t("web.workflow_ui.load_failed") });
      }
      return saved;
    } catch (error) {
      reportError(error);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        stretch="auto"
        variant="secondary"
        size="sm"
        icon={<Plus className="size-3.5" />}
        label={t("web.workflow_ui.types_settings.add")}
        disabled={disabled || busy}
        onClick={() => void create()}
      />
      {hierarchy && (
        <TypesEditor
          type={{}}
          hierarchy={hierarchy}
          open={open}
          busy={busy}
          onClose={() => setOpen(false)}
          onClosed={() => setHierarchy(null)}
          onSave={save}
        />
      )}
    </>
  );
}
