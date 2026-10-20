import { useState } from "react";
import { observer } from "mobx-react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { EUserPermissions, EUserPermissionsLevel, EXPORTERS_LIST } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TWorkItemFilterExpression } from "@plane/types";
import { useUserPermissions } from "@/hooks/store/user";
import { ProjectExportService } from "@/services/project/project-export.service";

const service = new ProjectExportService();
export const ScopedWorkItemExportModal = observer(function ScopedWorkItemExportModal({
  workspaceSlug,
  projectId,
  entityId,
  entityName,
  entityType,
  richFilters,
  open,
  onClose,
}: {
  workspaceSlug: string;
  projectId: string;
  entityId: string;
  entityName: string;
  entityType: "cycle" | "module" | "view";
  richFilters?: TWorkItemFilterExpression;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const [provider, setProvider] = useState("csv");
  const [loading, setLoading] = useState(false);
  const canExport =
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.WORKSPACE,
      workspaceSlug
    ) &&
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      workspaceSlug,
      projectId
    );
  const submit = async () => {
    if (!canExport || loading) return;
    setLoading(true);
    try {
      await service.csvExport(workspaceSlug, {
        provider,
        project: [projectId],
        multiple: false,
        rich_filters: entityType === "view" ? (richFilters ?? {}) : { [`${entityType}_id__in`]: entityId },
      });
      setToast({
        type: "success",
        title: t("workspace_settings.settings.exports.modal.toasts.success.title"),
        message: t("workspace_settings.settings.exports.modal.toasts.success.message", {
          entity: provider.toUpperCase(),
        }),
      });
      onClose();
    } catch {
      setToast({
        type: "error",
        title: t("error"),
        message: t("workspace_settings.settings.exports.modal.toasts.error.message"),
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (!next && loading) details.cancel();
        else if (!next) onClose();
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>
                {t("export")} · {entityName}
              </DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <label htmlFor={`${entityType}-export-${entityId}`} className="text-13 text-secondary">
              {t("workspace_settings.settings.exports.format")}
            </label>
            <Select
              value={provider}
              onValueChange={(value) => {
                if (value) setProvider(value);
              }}
              disabled={loading}
              items={EXPORTERS_LIST.map(({ provider: value }) => ({ value, label: value.toUpperCase() }))}
            >
              <SelectTrigger id={`${entityType}-export-${entityId}`} size="md" />
              <SelectContent sizing="anchor-fixed">
                <SelectList>
                  {EXPORTERS_LIST.map(({ provider: value }) => (
                    <SelectItem key={value} value={value} label={value.toUpperCase()} />
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
            <a href={`/${workspaceSlug}/settings/exports/`} className="mt-3 inline-block text-13 text-accent-primary">
              {t("workspace_settings.settings.exports.previous_exports")}
            </a>
          </DialogBody>
        </DialogMain>
        <DialogActions>
          <Button
            stretch="auto"
            size="md"
            variant="secondary"
            label={t("cancel")}
            disabled={loading}
            onClick={onClose}
          />
          <Button
            stretch="auto"
            size="md"
            variant="primary"
            label={t("workspace_settings.settings.exports.start_export")}
            loading={loading}
            disabled={!canExport || loading}
            onClick={() => void submit()}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});

export function CycleExportModal({
  cycleId,
  cycleName,
  ...props
}: {
  workspaceSlug: string;
  projectId: string;
  cycleId: string;
  cycleName: string;
  open: boolean;
  onClose: () => void;
}) {
  return <ScopedWorkItemExportModal {...props} entityType="cycle" entityId={cycleId} entityName={cycleName} />;
}
