import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import useSWR from "swr";
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { PagesOutline, WorkItemsOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { Menu, MenuTrigger, MenuItem } from "@makeplane/propel/components/menu";
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
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { useTranslation } from "@plane/i18n";
import { SettingsHeading } from "@/components/settings/heading";
import { WorkspaceProjectIcon } from "../sidebar/item-icon";
import {
  configurationKey,
  workspaceConfigurationService as service,
  type WorkspaceTemplate,
} from "@/services/workspace-configuration.service";
export const TEMPLATE_KINDS = ["project", "work_item", "page"] as const;
export const templateRouteKind = (kind: WorkspaceTemplate["kind"]) => (kind === "work_item" ? "work-item" : kind);
export function ConfigurationManager() {
  const { workspaceSlug = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, error, mutate } = useSWR(configurationKey(workspaceSlug, "templates"), () =>
    service.list<WorkspaceTemplate>(workspaceSlug, "templates")
  );
  const [deleting, setDeleting] = useState<WorkspaceTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const go = (kind: WorkspaceTemplate["kind"], id?: string) =>
    navigate(`/${workspaceSlug}/settings/templates/${templateRouteKind(kind)}/${id ? `${id}/` : ""}`);
  return (
    <div className="flex flex-col gap-5">
      <SettingsHeading
        title={t("web.templates")}
        description={t("web.templates_description")}
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
              {TEMPLATE_KINDS.map((kind) => (
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
      {error ? (
        <div className="flex items-center gap-3 text-13">
          <span>{t("web.configuration_load_error")}</span>
          <Button
            stretch="auto"
            size="md"
            variant="secondary"
            label={t("common.retry")}
            onClick={() => void mutate()}
          />
        </div>
      ) : !data ? (
        <p aria-busy="true">{t("loading")}</p>
      ) : !data.length ? (
        <EmptyStateCompact
          rootClassName="rounded-lg border border-subtle bg-surface-1 px-4 py-10"
          assetKey="template"
          assetClassName="size-20"
          title={t("web.templates_empty")}
          description={t("web.templates_empty_description")}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-subtle bg-surface-1">
          {data.map((entry) => {
            const Glyph =
              entry.kind === "project" ? WorkspaceProjectIcon : entry.kind === "page" ? PagesOutline : WorkItemsOutline;
            return (
              <div key={entry.id} className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-0">
                <Glyph className="size-4 shrink-0 text-tertiary" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => go(entry.kind, entry.id)}>
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
                    <MenuItem
                      label={t("edit")}
                      icon={<Pencil className="size-4" />}
                      onClick={() => go(entry.kind, entry.id)}
                    />
                    <MenuItem
                      label={t("delete")}
                      icon={<Trash2 className="size-4" />}
                      variant="danger"
                      onClick={() => setDeleting(entry)}
                    />
                  </MenuContent>
                </Menu>
              </div>
            );
          })}
        </div>
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent size="sm">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>
                  {t("delete")} {deleting?.name}
                </DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>{t("web.template_delete_hint")}</DialogBody>
          </DialogMain>
          <DialogActions>
            <Button
              stretch="auto"
              size="md"
              variant="secondary"
              label={t("cancel")}
              disabled={busy}
              onClick={() => setDeleting(null)}
            />
            <Button
              stretch="auto"
              size="md"
              variant="primary"
              label={t("delete")}
              loading={busy}
              onClick={async () => {
                if (!deleting || busy) return;
                setBusy(true);
                try {
                  await service.remove(workspaceSlug, "templates", deleting.id);
                  await mutate();
                  setDeleting(null);
                } catch {
                  setMessage(t("web.configuration_delete_error"));
                  setDeleting(null);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </DialogActions>
        </DialogContent>
      </Dialog>
    </div>
  );
}
