import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogContent,
  DialogMain,
  DialogHeader,
  DialogHeading,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@makeplane/propel/components/dialog";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectWorkflow } from "@/hooks/store/use-project-workflow";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
import { IssueTypeSelect } from "@/components/dropdowns/issue-type-select";
import { StateSelect } from "@/components/dropdowns/state/state-select";
import { getWorkflowErrorCode, getWorkflowErrorReason } from "@/helpers/workflow";

export type TIssueTypeSwitcherProps = { issueId: string; disabled: boolean };
export const IssueTypeSwitcher = observer(function IssueTypeSwitcher({ issueId, disabled }: TIssueTypeSwitcherProps) {
  const { workspaceSlug = "" } = useParams(),
    { t } = useTranslation();
  const {
    issue: { getIssueById, updateIssue },
  } = useIssueDetail();
  const issue = getIssueById(issueId),
    store = useProjectWorkflow(issue?.project_id ?? undefined);
  const [pending, setPending] = useState<{ typeId: string | null; stateId: string | null } | null>(null),
    [busy, setBusy] = useState(false);
  if (!issue?.project_id) return null;
  const projectId = issue.project_id;
  const save = async (typeId: string | null, stateId?: string | null) => {
    setBusy(true);
    try {
      await updateIssue(workspaceSlug, projectId, issueId, {
        type_id: typeId,
        ...(stateId ? { state_id: stateId } : {}),
      });
      setPending(null);
    } catch (error) {
      const code = getWorkflowErrorCode(error);
      if (code === "WORKFLOW_STATE_MAPPING_REQUIRED") setPending({ typeId, stateId: null });
      else
        setToast({
          type: "error",
          title: t("error"),
          message:
            getWorkflowErrorReason(error) ??
            (code ? t(`web.workflow_errors.${code}`) : t("web.workflow_ui.save_failed")),
        });
    } finally {
      setBusy(false);
    }
  };
  const changeType = (typeId: string | null) => {
    if (typeId === issue.type_id) return;
    const workflow = store.resolve(projectId, typeId);
    if (workflow?.enabled && workflow.is_active && !workflow.states.some((state) => state.id === issue.state_id))
      setPending({ typeId, stateId: null });
    else void save(typeId);
  };
  const target = pending ? store.resolve(projectId, pending.typeId) : undefined;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <IssueIdentifier issueId={issueId} projectId={projectId} size="md" enableClickToCopyIdentifier />
        <IssueTypeSelect
          projectId={projectId}
          value={issue.type_id}
          onChange={changeType}
          disabled={disabled || busy}
        />
      </div>
      {pending && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null);
          }}
        >
          <DialogContent size="sm">
            <DialogMain>
              <DialogHeader>
                <DialogHeading>
                  <DialogTitle>{t("web.workflow_ui.type_mapping_title")}</DialogTitle>
                </DialogHeading>
              </DialogHeader>
              <DialogBody>
                <p className="mb-3 text-body-xs-regular text-secondary">{t("web.workflow_ui.type_mapping_hint")}</p>
                <StateSelect
                  projectId={projectId}
                  value={pending.stateId}
                  bypassWorkflow
                  allowedStates={target?.states.map((state) => state.id)}
                  variant="select-md"
                  onChange={(stateId) => setPending({ ...pending, stateId })}
                  disabled={busy}
                />
              </DialogBody>
              <DialogActions>
                <Button
                  stretch="auto"
                  size="md"
                  variant="ghost"
                  disabled={busy}
                  label={t("cancel")}
                  onClick={() => setPending(null)}
                />
                <Button
                  stretch="auto"
                  size="md"
                  variant="primary"
                  disabled={busy || !pending.stateId}
                  label={t("save")}
                  onClick={() => void save(pending.typeId, pending.stateId)}
                />
              </DialogActions>
            </DialogMain>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});
