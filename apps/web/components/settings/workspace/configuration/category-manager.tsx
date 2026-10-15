import { cn } from "@plane/utils";
import { STATE_ROW_CLASS_NAME, STATE_ROW_DIVIDER_CLASS_NAME } from "@/components/project-states/row-layout";
import { SortableItem, SortableProvider } from "@plane/blocks/sortable";
import { StateSummary } from "@/components/project-states/state-summary";
import { StateGroupIcon } from "@plane/blocks/icons";
import { EIconSize } from "@plane/constants";
import type { TStateGroups } from "@plane/types";
import { StateForm } from "@/components/project-states/create-update/form";
import { StateGroupPanel } from "@/components/project-states/group-panel";
import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
import { CategoryColorPicker } from "./category-color-picker";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import useSWR from "swr";
import { GripVertical, MoreHorizontal, Pencil, Trash2, Tag, Circle, Check } from "lucide-react";
import { Button } from "@makeplane/propel/components/button";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { InputField } from "@makeplane/propel/components/input-field";
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
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { SettingsHeading } from "@/components/settings/heading";
import {
  configurationKey,
  workspaceConfigurationService as service,
  type ProjectCategory,
} from "@/services/workspace-configuration.service";

const phaseIcons: Record<string, TStateGroups> = {
  draft: "backlog",
  planning: "unstarted",
  execution: "started",
  monitoring: "started",
  completed: "completed",
  cancelled: "cancelled",
};
type Draft = { id?: string; name: string; color: string; group?: string; description?: string };
export function CategoryManager({ kind, group }: { kind: "status" | "label"; group?: string }) {
  const { workspaceSlug = "" } = useParams();
  const { t } = useTranslation();
  const resource = `project-categories/${kind}` as const;
  const { data, error, mutate } = useSWR(configurationKey(workspaceSlug, resource), () =>
    service.list<ProjectCategory>(workspaceSlug, resource)
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<ProjectCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const editingId = draft ? (draft.id ?? "new") : null;
  useEffect(() => {
    if (editingId !== null) editorRef.current?.querySelector<HTMLInputElement>("input:not([type=color])")?.focus();
  }, [editingId]);
  const label = kind === "label";
  const Glyph = label ? Tag : Circle;
  const begin = (entry?: ProjectCategory) => {
    setMessage("");
    setDraft(entry ?? { name: "", color: "#60646C", group, description: "" });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await service.save(workspaceSlug, resource, draft);
      await mutate();
      const savedName = draft.name.trim();
      setDraft(null);
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`button[data-category-name="${CSS.escape(savedName)}"]`)?.focus();
      });
    } catch {
      setMessage(t("web.configuration_save_error"));
    } finally {
      setBusy(false);
    }
  };
  const reorder = async (from: string, target: string) => {
    if (!data || busy || from === target || draft) return;
    const entries = [...data];
    const index = entries.findIndex((e) => e.id === from);
    const to = entries.findIndex((e) => e.id === target);
    if (index < 0 || to < 0) return;
    const [entry] = entries.splice(index, 1);
    entries.splice(to, 0, entry);
    setBusy(true);
    setMessage("");
    try {
      await service.reorder(
        workspaceSlug,
        kind,
        entries.map((e) => e.id)
      );
      await mutate(entries, false);
    } catch (reorderError) {
      setMessage(t("web.category_order_error"));
      await mutate();
      throw reorderError;
    } finally {
      setBusy(false);
    }
  };
  const editor =
    draft &&
    (kind === "status" ? (
      <StateForm
        key={draft.id ?? "new"}
        data={{ name: draft.name, color: draft.color, description: draft.description }}
        stateGroup={phaseIcons[group ?? draft.group ?? "draft"]}
        buttonTitle={t(draft.id ? "web.update" : "web.create")}
        buttonDisabled={busy}
        onCancel={() => setDraft(null)}
        onSubmit={async (formData) => {
          setBusy(true);
          setMessage("");
          try {
            await service.save(workspaceSlug, resource, {
              id: draft.id,
              group,
              name: formData.name,
              color: formData.color,
              description: formData.description,
            });
            await mutate();
            setDraft(null);
            return { status: "success" };
          } catch {
            setMessage(t("web.configuration_save_error"));
            return { status: "error" };
          } finally {
            setBusy(false);
          }
        }}
      />
    ) : (
      <form
        onSubmit={save}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-surface-1 p-3"
      >
        <CategoryColorPicker
          value={draft.color}
          onChange={(color) => setDraft({ ...draft, color })}
          disabled={busy}
          kind={kind}
        />
        <div ref={editorRef} className="min-w-32 flex-1">
          <InputField
            size="lg"
            orientation="vertical"
            aria-label={t(label ? "web.project_label_name" : "web.project_status_name")}
            placeholder={t(label ? "web.project_label_name" : "web.project_status_name")}
            value={draft.name}
            maxLength={100}
            required
            disabled={busy}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        {!label && (
          <textarea
            aria-label={t("web.project_status_description")}
            placeholder={t("web.project_status_description")}
            className="order-last w-full rounded-md border border-subtle p-2 text-13"
            value={draft.description ?? ""}
            maxLength={1000}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        )}
        <Button
          stretch="auto"
          size="md"
          variant="secondary"
          label={t("cancel")}
          disabled={busy}
          onClick={() => setDraft(null)}
        />
        <Button
          stretch="auto"
          size="md"
          variant="primary"
          type="submit"
          label={t(draft.id ? "update" : "add")}
          disabled={!draft.name.trim() || busy}
          loading={busy}
        />
      </form>
    ));
  const content = (
    <div className="flex flex-col gap-5">
      {!group && (
        <SettingsHeading
          variant="h4"
          title={group ? t(`web.project_phase_${group}`) : t(label ? "web.project_labels" : "web.project_statuses")}
          description={
            group ? undefined : t(label ? "web.project_labels_description" : "web.project_statuses_description")
          }
          control={
            <Button
              stretch="auto"
              size="md"
              variant="secondary"
              label={t(label ? "web.add_project_label" : "web.add_project_status")}
              disabled={busy || !!draft}
              onClick={() => begin()}
            />
          }
        />
      )}
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
      ) : (
        <div className={cn("flex flex-col", label ? "gap-2" : "gap-0")}>
          {label && draft && !draft.id && editor}
          {data
            .filter((entry) => !group || entry.group === group)
            .map((entry, sortableIndex) =>
              draft?.id === entry.id ? (
                <div key={entry.id} className={label ? undefined : STATE_ROW_DIVIDER_CLASS_NAME}>
                  {editor}
                </div>
              ) : (
                <SortableItem
                  key={entry.id}
                  id={entry.id}
                  index={sortableIndex}
                  group={group ?? kind}
                  disabled={busy || !!draft}
                  className={cn(
                    label
                      ? "group relative flex min-h-12 items-center gap-3 rounded-lg border border-subtle bg-surface-1 px-3 py-2"
                      : cn(STATE_ROW_CLASS_NAME, STATE_ROW_DIVIDER_CLASS_NAME, "gap-2")
                  )}
                >
                  {({ handleRef }) => (
                    <>
                      <button
                        type="button"
                        ref={handleRef}
                        disabled={busy || !!draft}
                        aria-label={`${t("web.reorder_category")} ${entry.name}`}
                        title={t("web.reorder_category_hint")}
                        className={cn(
                          "cursor-grab touch-none rounded focus-visible:ring-2 focus-visible:ring-accent-strong active:cursor-grabbing",
                          label
                            ? "text-tertiary"
                            : "absolute -left-2.5 text-placeholder opacity-0 transition-opacity group-focus-within:opacity-80 group-hover:opacity-60 hover:text-tertiary hover:opacity-100"
                        )}
                      >
                        <GripVertical className={label ? "size-4" : "size-3"} />
                      </button>
                      {label && <Glyph className="size-4 shrink-0" style={{ color: entry.color }} />}
                      <button
                        type="button"
                        data-category-name={entry.name}
                        className="min-w-0 flex-1 truncate text-left text-13 font-medium"
                        disabled={busy || !!draft}
                        onClick={() => begin(entry)}
                      >
                        {label ? (
                          entry.name
                        ) : (
                          <StateSummary
                            icon={
                              <StateGroupIcon
                                stateGroup={phaseIcons[entry.group]}
                                color={entry.color}
                                size={EIconSize.XL}
                              />
                            }
                            name={entry.name}
                            color={entry.color}
                            description={entry.description}
                            badge={
                              entry.is_default ? (
                                <span className="font-normal shrink-0 text-12 text-tertiary">
                                  ·{t("web.project_status_default")}
                                </span>
                              ) : undefined
                            }
                          />
                        )}
                      </button>
                      <div
                        className={cn(
                          "flex shrink-0 items-center self-center",
                          !label &&
                            "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-popup-open]]:opacity-100 [@media(hover:none)]:opacity-100"
                        )}
                      >
                        <Menu>
                          <MenuTrigger
                            render={
                              <IconButton
                                icon={<MoreHorizontal className="size-4 group-hover:text-primary" />}
                                aria-label={`${t("web.category_actions")} ${entry.name}`}
                                variant="ghost"
                                size="xs"
                                showTooltip={false}
                                disabled={busy || !!draft}
                              />
                            }
                          />
                          <MenuContent align="end" sizing="anchor">
                            <div className="min-w-30">
                              {!label && !entry.is_default && (
                                <MenuItem
                                  label={t("web.project_status_make_default")}
                                  icon={<Check className="size-4" />}
                                  onClick={async () => {
                                    try {
                                      await service.save(workspaceSlug, resource, { id: entry.id, is_default: true });
                                      await mutate();
                                    } catch {
                                      setMessage(t("web.configuration_save_error"));
                                    }
                                  }}
                                />
                              )}
                              <MenuItem
                                label={t("edit")}
                                icon={<Pencil className="size-4" />}
                                onClick={() => begin(entry)}
                              />
                              <MenuItem
                                label={t("delete")}
                                variant="danger"
                                icon={<Trash2 className="size-4" />}
                                disabled={
                                  !label &&
                                  (entry.is_default || data.filter((item) => item.group === entry.group).length <= 1)
                                }
                                onClick={() => setDeleting(entry)}
                              />
                            </div>
                          </MenuContent>
                        </Menu>
                      </div>
                    </>
                  )}
                </SortableItem>
              )
            )}
          {!label && draft && !draft.id && editor}
          {!data.length && !draft && !group && (
            <EmptyStateCompact
              rootClassName="rounded-lg border border-subtle bg-surface-1 px-4 py-10"
              assetKey={label ? "label" : "state"}
              assetClassName="size-20"
              title={t(label ? "web.project_labels_empty" : "web.project_statuses_empty")}
              description={
                group ? undefined : t(label ? "web.project_labels_description" : "web.project_statuses_description")
              }
            />
          )}
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
            <DialogBody>{t("web.category_delete_hint")}</DialogBody>
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
                  await service.remove(workspaceSlug, resource, deleting.id);
                  await mutate();
                  setDeleting(null);
                } catch {
                  setMessage(t(label ? "web.configuration_delete_error" : "web.project_status_delete_error"));
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
  return group ? (
    <StateGroupPanel
      title={t(`web.project_phase_${group}`)}
      addDisabled={busy || !!draft}
      onAdd={() => {
        begin();
      }}
    >
      <SortableProvider
        disabled={busy || !!draft}
        onSortEnd={async ({ id, index }) => {
          const target = data?.filter((item) => !group || item.group === group)[index];
          if (target) await reorder(id, target.id);
        }}
      >
        {content}
      </SortableProvider>
    </StateGroupPanel>
  ) : (
    <SortableProvider
      disabled={busy || !!draft}
      onSortEnd={async ({ id, index }) => {
        const target = data?.[index];
        if (target) await reorder(id, target.id);
      }}
    >
      {content}
    </SortableProvider>
  );
}
