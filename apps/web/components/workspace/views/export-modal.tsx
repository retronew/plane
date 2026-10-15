import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { Button } from "@makeplane/propel/components/button";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
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
import { EUserPermissions, EUserPermissionsLevel, EXPORTERS_LIST } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import { EIssuesStoreType } from "@plane/types";
import { useIssues } from "@/hooks/store/use-issues";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { ProjectExportService } from "@/services/project/project-export.service";
import { getWorkspaceViewExportFilters } from "./export-filters";

const exportService = new ProjectExportService();

export const WorkspaceViewExportModal = observer(function WorkspaceViewExportModal({
  workspaceSlug,
  viewId,
  open,
  onClose,
}: {
  workspaceSlug: string;
  viewId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: user } = useUser();
  const { allowPermissions } = useUserPermissions();
  const { issuesFilter } = useIssues(EIssuesStoreType.GLOBAL);
  const viewFilters = issuesFilter.getIssueFilters(viewId);
  const [provider, setProvider] = useState("csv");
  const [loading, setLoading] = useState(false);
  const canExport = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const submit = async () => {
    if (!user || !viewFilters || !canExport || loading) return;
    setLoading(true);
    try {
      const filters = issuesFilter.getIssueFilters(viewId);
      await exportService.csvExport(workspaceSlug, {
        provider,
        project: [],
        multiple: false,
        rich_filters: getWorkspaceViewExportFilters(viewId, user.id, filters?.richFilters, filters?.displayFilters),
      });
      setToast({
        type: "success",
        title: t("workspace_settings.settings.exports.modal.toasts.success.title"),
        message: t("workspace_views.export_description"),
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
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && loading) details.cancel();
        else if (!nextOpen) onClose();
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) setProvider("csv");
      }}
    >
      <DialogContent size="sm">
        <DialogMain>
          <DialogHeader>
            <DialogHeading>
              <DialogTitle>{t("export")}</DialogTitle>
            </DialogHeading>
          </DialogHeader>
          <DialogBody>
            <div className="flex min-w-0 flex-col gap-2 [&_button]:w-full [&_button]:min-w-0">
              <label htmlFor="view-export-format" className="text-13 font-medium text-secondary">
                {t("workspace_settings.settings.exports.format")}
              </label>
              <Select
                value={provider}
                onValueChange={(value) => value && setProvider(value)}
                disabled={loading}
                items={EXPORTERS_LIST.map((option) => ({
                  value: option.provider,
                  label: option.provider === "xlsx" ? "Excel" : option.provider.toUpperCase(),
                }))}
              >
                <SelectTrigger id="view-export-format" size="md" />
                <SelectContent sizing="anchor-fixed">
                  <SelectList>
                    {EXPORTERS_LIST.map((option) => (
                      <SelectItem
                        key={option.provider}
                        value={option.provider}
                        label={option.provider === "xlsx" ? "Excel" : option.provider.toUpperCase()}
                      />
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </div>
            <p className="mt-4 text-12 text-tertiary">{t("workspace_views.export_description")}</p>
            <Link
              href={`/${workspaceSlug}/settings/exports/`}
              className="mt-1 inline-block text-12 text-accent-primary hover:underline"
            >
              {t("workspace_views.export_history")}
            </Link>
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
            label={t("web.continue")}
            loading={loading}
            disabled={!user || !viewFilters || !canExport || loading}
            onClick={() => void submit()}
          />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
});
