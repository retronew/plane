import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@makeplane/propel/components/button";
import { InputField } from "@makeplane/propel/components/input-field";
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
import type { THierarchyPreview, THierarchyRequest, TProjectIssueHierarchy } from "@plane/types";
import type { ProjectWorkflowService } from "@/services/project/workflow.service";

const key = "web.issue_hierarchy";
export function HierarchyImpactDialog({
  open,
  request,
  service,
  workspaceSlug,
  projectId,
  onClose,
  onClosed,
  onApplied,
}: {
  open: boolean;
  request: THierarchyRequest;
  service: ProjectWorkflowService;
  workspaceSlug: string;
  projectId: string;
  onClose: () => void;
  onClosed: () => void;
  onApplied: (config: TProjectIssueHierarchy) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState<THierarchyPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [applied, setApplied] = useState(false);
  useLayoutEffect(() => {
    // Commit the closed Dialog root before opening so its enter animation runs.
    // eslint-disable-next-line react/set-state-in-effect
    setMounted(true);
  }, []);
  const previewOwner = useRef(0);
  const refreshPreview = async () => {
    const owner = ++previewOwner.current;
    setBusy(true);
    setError(null);
    setConfirmation("");
    try {
      const latest = await service.hierarchy(workspaceSlug, projectId);
      if (owner !== previewOwner.current) return;
      const ids = new Set(latest.issue_types.map((type) => type.id));
      if (request.type_levels.length !== ids.size || request.type_levels.some((type) => !ids.has(type.type_id))) {
        setError(`${key}.types_changed`);
        return;
      }
      const result = await service.previewHierarchy(workspaceSlug, projectId, {
        ...request,
        policy_version: latest.policy_version,
      });
      if (owner === previewOwner.current) setPreview(result);
    } catch {
      if (owner === previewOwner.current) setError(`${key}.preview_failed`);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const owner = ++previewOwner.current;
    service
      .previewHierarchy(workspaceSlug, projectId, request)
      .then((result) => {
        if (owner === previewOwner.current) setPreview(result);
        return result;
      })
      .catch(() => {
        if (owner === previewOwner.current) setError(`${key}.preview_failed`);
      });
    return () => {
      // Invalidate this request identity, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      previewOwner.current = owner + 1;
    };
  }, [service, workspaceSlug, projectId, request]);
  const apply = async () => {
    if (!preview || busy || applied) return;
    setBusy(true);
    setError(null);
    try {
      const result = await service.applyHierarchy(workspaceSlug, projectId, {
        ...request,
        policy_version: preview.policy_version,
        token: preview.token,
        confirm_detach: preview.conflict_count > 0,
      });
      setApplied(true);
      // A successful mutation must never be repeated because a subsequent cache refresh failed.
      await onApplied(result.config);
    } catch (failure) {
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setPreview(null);
        setConfirmation("");
        setError(`${key}.stale`);
      } else setError(`${key}.apply_failed`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={mounted && open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed();
      }}
    >
      <DialogContent size="md">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t(`${key}.preview_title`)}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 text-body-xs-regular text-primary">
              {error && (
                <p role="alert" className="text-danger-primary">
                  {t(error)}
                </p>
              )}
              {!preview && !error && <p>{t("loading")}</p>}
              {preview && (
                <>
                  <p>{t(`${key}.final_levels`, { levels: preview.levels.join(", ") })}</p>
                  <p>{t(`${key}.final_default`, { level: preview.default_level })}</p>
                  <p>{t(`${key}.conflicts`, { count: preview.conflict_count })}</p>
                  <p className="text-secondary">{t(`${key}.detach_hint`)}</p>
                  <ul className="max-h-60 space-y-2 overflow-y-auto">
                    {preview.examples.map((example) => (
                      <li key={`${example.kind}-${example.id}`} className="rounded-md bg-layer-2 p-2 break-words">
                        {example.parent_name} → {example.name}
                        {example.kind === "draft" && <span className="ml-2 text-secondary">{t(`${key}.draft`)}</span>}
                      </li>
                    ))}
                  </ul>
                  {preview.conflict_count > 0 && (
                    <InputField
                      size="lg"
                      orientation="vertical"
                      label={t(`${key}.confirm_label`, { word: t(`${key}.confirm_word`) })}
                      value={confirmation}
                      disabled={busy}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  )}
                </>
              )}
            </div>
          </DialogBody>
          <DialogActions>
            <Button
              size="md"
              stretch="auto"
              variant="secondary"
              disabled={busy}
              label={t("cancel")}
              onClick={onClose}
            />
            {preview ? (
              <Button
                size="md"
                stretch="auto"
                variant="primary"
                label={t("confirm")}
                disabled={busy || applied || (preview.conflict_count > 0 && confirmation !== t(`${key}.confirm_word`))}
                onClick={() => void apply()}
              />
            ) : (
              <Button
                size="md"
                stretch="auto"
                variant="primary"
                label={t("web.workflow_ui.refresh_preview")}
                disabled={busy}
                onClick={() => void refreshPreview()}
              />
            )}
          </DialogActions>
        </DialogMain>
      </DialogContent>
    </Dialog>
  );
}
