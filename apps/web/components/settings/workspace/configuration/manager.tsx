import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import useSWR, { useSWRConfig } from "swr";
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { PagesOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { Menu, MenuTrigger, MenuItem } from "@makeplane/propel/components/menu";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import { SettingsHeading } from "@/components/settings/heading";
import { WorkspaceProjectIcon } from "../sidebar/item-icon";
import {
  configurationKey,
  projectConfigurationKey,
  workspaceConfigurationService as service,
  type WorkspaceTemplate,
} from "@/services/workspace-configuration.service";
export const TEMPLATE_KINDS = ["project", "work_item", "page"] as const;
const PROJECT_TEMPLATE_KINDS = ["work_item", "page"] as const;
export const templateRouteKind = (kind: WorkspaceTemplate["kind"]) => (kind === "work_item" ? "work-item" : kind);
function TemplateList({
  templates,
  hasError,
  projectScoped,
  onRetry,
  onEdit,
  onDelete,
}: {
  templates?: WorkspaceTemplate[];
  hasError: boolean;
  projectScoped: boolean;
  onRetry: () => void;
  onEdit: (entry: WorkspaceTemplate) => void;
  onDelete: (entry: WorkspaceTemplate) => void;
}) {
  const { t } = useTranslation();
  if (hasError)
    return (
      <div className="flex items-center gap-3 text-13">
        <span>{t("web.configuration_load_error")}</span>
        <Button stretch="auto" size="md" variant="secondary" label={t("common.retry")} onClick={onRetry} />
      </div>
    );
  if (!templates) return <p aria-busy="true">{t("loading")}</p>;
  if (!templates.length)
    return (
      <EmptyStateCompact
        rootClassName={projectScoped ? "py-10" : "rounded-lg border border-subtle bg-surface-1 px-4 py-10"}
        assetKey="template"
        assetClassName="size-20"
        title={t("web.templates_empty")}
        description={t(projectScoped ? "web.project_templates_empty_description" : "web.templates_empty_description")}
      />
    );
  return (
    <div className="overflow-hidden rounded-lg border border-subtle bg-surface-1">
      {templates.map((entry) => (
        <TemplateRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function TemplateRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: WorkspaceTemplate;
  onEdit: (entry: WorkspaceTemplate) => void;
  onDelete: (entry: WorkspaceTemplate) => void;
}) {
  const { t } = useTranslation();
  const Glyph =
    entry.kind === "project" ? WorkspaceProjectIcon : entry.kind === "page" ? PagesOutline : WorkItemsOutline;
  return (
    <div className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-0">
      <Glyph className="size-4 shrink-0 text-tertiary" />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(entry)}>
        <span className="block truncate text-13 font-medium">{entry.name}</span>
        <span className="block truncate text-12 text-tertiary">
          {entry.short_description || t(`web.template_kind_${entry.kind}`)}
        </span>
      </button>
      <span className="hidden text-12 text-tertiary sm:block">{t(`web.template_kind_${entry.kind}`)}</span>
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label={`${t("web.template_actions")} ${entry.name}`}
              className="grid size-7 place-items-center rounded text-tertiary hover:bg-layer-2"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </MenuTrigger>
        <MenuContent align="end" sizing="anchor">
          <MenuItem label={t("edit")} icon={<Pencil className="size-4" />} onClick={() => onEdit(entry)} />
          <MenuItem
            label={t("delete")}
            icon={<Trash2 className="size-4" />}
            variant="danger"
            onClick={() => onDelete(entry)}
          />
        </MenuContent>
      </Menu>
    </div>
  );
}

export function ConfigurationManager({ projectId }: { projectId?: string }) {
  const { workspaceSlug = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate: refresh } = useSWRConfig();
  const { data, error, mutate } = useSWR(
    projectId ? projectConfigurationKey(workspaceSlug, projectId) : configurationKey(workspaceSlug, "templates"),
    () =>
      projectId
        ? service.listProjectTemplates(workspaceSlug, projectId)
        : service.list<WorkspaceTemplate>(workspaceSlug, "templates")
  );
  const templates = projectId
    ? data?.filter((entry) => entry.project === projectId && (entry.kind === "work_item" || entry.kind === "page"))
    : data;
  const [deleting, setDeleting] = useState<WorkspaceTemplate | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const kinds = projectId ? PROJECT_TEMPLATE_KINDS : TEMPLATE_KINDS;
  const basePath = projectId
    ? `/${workspaceSlug}/settings/projects/${projectId}/templates`
    : `/${workspaceSlug}/settings/templates`;
  const go = (kind: WorkspaceTemplate["kind"], id?: string) =>
    navigate(`${basePath}/${templateRouteKind(kind)}/${id ? `${id}/` : ""}`);
  const removeTemplate = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (projectId) await service.removeProjectTemplate(workspaceSlug, projectId, deleting.id);
      else await service.remove(workspaceSlug, "templates", deleting.id);
      await Promise.all([
        mutate(),
        projectId
          ? refresh(configurationKey(workspaceSlug, "templates"))
          : deleting.project
            ? refresh(projectConfigurationKey(workspaceSlug, deleting.project))
            : Promise.resolve(),
      ]);
      setDeleteOpen(false);
    } catch {
      setMessage(t("web.configuration_delete_error"));
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <SettingsHeading
        title={t("web.templates")}
        description={t(projectId ? "web.project_templates_description" : "web.templates_description")}
        control={
          <Menu>
            <MenuTrigger
              render={
                <Button
                  stretch="auto"
                  size="md"
                  variant="primary"
                  label={t("web.create_template")}
                  iconPosition="end"
                  icon={<ChevronDown className="size-3.5" />}
                />
              }
            />
            <MenuContent align="end" sizing="anchor">
              {kinds.map((kind) => (
                <MenuItem key={kind} label={t(`web.template_kind_${kind}`)} onClick={() => go(kind)} />
              ))}
            </MenuContent>
          </Menu>
        }
      />
      {message && (
        <p role="alert" className="text-13 text-danger-primary">
          {message}
        </p>
      )}
      <TemplateList
        templates={templates}
        hasError={!!error}
        projectScoped={!!projectId}
        onRetry={() => void mutate()}
        onEdit={(entry) => go(entry.kind, entry.id)}
        onDelete={(entry) => {
          setDeleting(entry);
          setDeleteOpen(true);
        }}
      />
      <ConfirmDialog
        isOpen={deleteOpen}
        handleClose={() => {
          if (!busy) setDeleteOpen(false);
        }}
        handleSubmit={removeTemplate}
        isSubmitting={busy}
        title={`${t("delete")} ${deleting?.name ?? ""}`}
        content={t("web.template_delete_hint")}
      />
    </div>
  );
}
