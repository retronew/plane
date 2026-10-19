import { cn } from "@plane/utils";
import { STATE_ROW_CLASS_NAME, STATE_ROW_DIVIDER_CLASS_NAME } from "@/components/project-states/row-layout";
import { SortableItem, SortableProvider } from "@plane/blocks/sortable";
import { StateSummary } from "@/components/project-states/state-summary";
import { StateGroupIcon } from "@plane/blocks/icons";
import { EIconSize } from "@plane/constants";
import type { IState, TStateGroups } from "@plane/types";
import { StateForm } from "@/components/project-states/create-update/form";
import { StateGroupPanel } from "@/components/project-states/group-panel";
import { ActionMenuContent as MenuContent } from "@plane/blocks/common";
import { CategoryColorPicker } from "./category-color-picker";
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
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
  type ConfigurationResource,
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
type CategoryKind = "status" | "label";
type Draft = { id?: string; name: string; color: string; group?: string; description?: string };

type CategoryMutationContext = {
  workspaceSlug: string;
  resource: ConfigurationResource;
  kind: CategoryKind;
  t: (key: string) => string;
  reload: () => Promise<unknown>;
  applyOrder: (entries: ProjectCategory[]) => Promise<unknown>;
  setBusy: (value: boolean) => void;
  setMessage: (value: string) => void;
};

async function saveCategory({
  event,
  draft,
  busy,
  context,
  setDraft,
}: {
  event: FormEvent;
  draft: Draft | null;
  busy: boolean;
  context: CategoryMutationContext;
  setDraft: (value: Draft | null) => void;
}) {
  event.preventDefault();
  if (!draft || busy) return;
  const { workspaceSlug, resource, reload, setBusy, setMessage, t } = context;
  setBusy(true);
  setMessage("");
  try {
    await service.save(workspaceSlug, resource, draft);
    await reload();
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
}

async function submitStateCategory({
  draft,
  group,
  formData,
  context,
  setDraft,
}: {
  draft: Draft;
  group?: string;
  formData: Partial<IState>;
  context: CategoryMutationContext;
  setDraft: (value: Draft | null) => void;
}): Promise<{ status: "success" | "error" }> {
  const { workspaceSlug, resource, reload, setBusy, setMessage, t } = context;
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
    await reload();
    setDraft(null);
    return { status: "success" };
  } catch {
    setMessage(t("web.configuration_save_error"));
    return { status: "error" };
  } finally {
    setBusy(false);
  }
}

async function makeCategoryDefault({ entry, context }: { entry: ProjectCategory; context: CategoryMutationContext }) {
  const { workspaceSlug, resource, reload, setMessage, t } = context;
  try {
    await service.save(workspaceSlug, resource, { id: entry.id, is_default: true });
    await reload();
  } catch {
    setMessage(t("web.configuration_save_error"));
  }
}

async function reorderCategories({
  from,
  target,
  data,
  busy,
  draft,
  context,
}: {
  from: string;
  target: string;
  data: ProjectCategory[] | undefined;
  busy: boolean;
  draft: Draft | null;
  context: CategoryMutationContext;
}) {
  if (!data || busy || from === target || draft) return;
  const entries = [...data];
  const index = entries.findIndex((e) => e.id === from);
  const to = entries.findIndex((e) => e.id === target);
  if (index < 0 || to < 0) return;
  const [entry] = entries.splice(index, 1);
  entries.splice(to, 0, entry);
  const { workspaceSlug, kind, reload, applyOrder, setBusy, setMessage, t } = context;
  setBusy(true);
  setMessage("");
  try {
    await service.reorder(
      workspaceSlug,
      kind,
      entries.map((e) => e.id)
    );
    await applyOrder(entries);
  } catch (reorderError) {
    setMessage(t("web.category_order_error"));
    await reload();
    throw reorderError;
  } finally {
    setBusy(false);
  }
}

async function deleteCategory({
  deleting,
  busy,
  label,
  context,
  setDeleting,
}: {
  deleting: ProjectCategory | null;
  busy: boolean;
  label: boolean;
  context: CategoryMutationContext;
  setDeleting: (value: ProjectCategory | null) => void;
}) {
  if (!deleting || busy) return;
  const { workspaceSlug, resource, reload, setBusy, setMessage, t } = context;
  setBusy(true);
  try {
    await service.remove(workspaceSlug, resource, deleting.id);
    await reload();
    setDeleting(null);
  } catch {
    setMessage(t(label ? "web.configuration_delete_error" : "web.project_status_delete_error"));
    setDeleting(null);
  } finally {
    setBusy(false);
  }
}

export function CategoryManager({ kind, group }: { kind: CategoryKind; group?: string }) {
  const { workspaceSlug = "" } = useParams();
  const { t } = useTranslation();
  const resource = `project-categories/${kind}` as const;
  const { data, error, mutate } = useSWR(configurationKey(workspaceSlug, resource), () =>
    service.list<ProjectCategory>(workspaceSlug, resource)
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [colorPickerInitiallyOpen, setColorPickerInitiallyOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProjectCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const editingId = draft ? (draft.id ?? "new") : null;
  useEffect(() => {
    if (editingId !== null) editorRef.current?.querySelector<HTMLInputElement>("input:not([type=color])")?.focus();
  }, [editingId]);
  const label = kind === "label";
  const context: CategoryMutationContext = {
    workspaceSlug,
    resource,
    kind,
    t,
    reload: () => mutate(),
    applyOrder: (entries: ProjectCategory[]) => mutate(entries, false),
    setBusy,
    setMessage,
  };
  const begin = (entry?: ProjectCategory, openColor = false) => {
    setColorPickerInitiallyOpen(openColor);
    setMessage("");
    setDraft(entry ?? { name: "", color: "#60646C", group, description: "" });
  };
  const editor = draft ? (
    <CategoryEditorPanel
      draft={draft}
      kind={kind}
      group={group}
      label={label}
      busy={busy}
      colorPickerInitiallyOpen={colorPickerInitiallyOpen}
      editorRef={editorRef}
      onChange={(patch) => setDraft({ ...draft, ...patch })}
      onCancel={() => setDraft(null)}
      onLabelSubmit={(event) => saveCategory({ event, draft, busy, context, setDraft })}
      onStateSubmit={(formData) => submitStateCategory({ draft, group, formData, context, setDraft })}
    />
  ) : null;
  return (
    <CategoryManagerView
      group={group}
      kind={kind}
      label={label}
      data={data}
      error={error}
      message={message}
      draft={draft}
      busy={busy}
      deleting={deleting}
      editor={editor}
      onRetry={() => void mutate()}
      onAdd={() => begin()}
      onBegin={begin}
      onDelete={setDeleting}
      onMakeDefault={(entry) => makeCategoryDefault({ entry, context })}
      onReorder={(from, target) => reorderCategories({ from, target, data, busy, draft, context })}
      onDeleteOpenChange={(open) => {
        if (!open && !busy) setDeleting(null);
      }}
      onDeleteCancel={() => setDeleting(null)}
      onDeleteConfirm={() => deleteCategory({ deleting, busy, label, context, setDeleting })}
    />
  );
}

type CategoryManagerViewProps = {
  group?: string;
  kind: CategoryKind;
  label: boolean;
  data: ProjectCategory[] | undefined;
  error: unknown;
  message: string;
  draft: Draft | null;
  busy: boolean;
  deleting: ProjectCategory | null;
  editor: ReactNode;
  onRetry: () => void;
  onAdd: () => void;
  onBegin: (entry?: ProjectCategory, openColor?: boolean) => void;
  onDelete: (entry: ProjectCategory) => void;
  onMakeDefault: (entry: ProjectCategory) => void;
  onReorder: (from: string, target: string) => Promise<void>;
  onDeleteOpenChange: (open: boolean) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
};

function CategoryManagerView({
  group,
  kind,
  label,
  data,
  error,
  message,
  draft,
  busy,
  deleting,
  editor,
  onRetry,
  onAdd,
  onBegin,
  onDelete,
  onMakeDefault,
  onReorder,
  onDeleteOpenChange,
  onDeleteCancel,
  onDeleteConfirm,
}: CategoryManagerViewProps) {
  const { t } = useTranslation();
  const disabled = busy || !!draft;
  const content = (
    <div className="flex flex-col gap-5">
      {!group && <CategoryManagerHeader label={label} addDisabled={disabled} onAdd={onAdd} />}
      {message && (
        <p role="alert" className="text-13 text-danger-primary">
          {message}
        </p>
      )}
      {error ? (
        <div className="flex items-center gap-3 text-13">
          <span>{t("web.configuration_load_error")}</span>
          <Button stretch="auto" size="md" variant="secondary" label={t("common.retry")} onClick={onRetry} />
        </div>
      ) : !data ? (
        <p aria-busy="true">{t("loading")}</p>
      ) : (
        <CategoryList
          data={data}
          group={group}
          kind={kind}
          label={label}
          draft={draft}
          disabled={disabled}
          editor={editor}
          onBegin={onBegin}
          onDelete={onDelete}
          onMakeDefault={onMakeDefault}
        />
      )}
      <CategoryDeleteDialog
        deleting={deleting}
        busy={busy}
        onOpenChange={onDeleteOpenChange}
        onCancel={onDeleteCancel}
        onConfirm={onDeleteConfirm}
      />
    </div>
  );
  return group ? (
    <StateGroupPanel title={t(`web.project_phase_${group}`)} addDisabled={disabled} onAdd={onAdd}>
      <SortableProvider
        disabled={disabled}
        onSortEnd={async ({ id, index }) => {
          const target = data?.filter((item) => !group || item.group === group)[index];
          if (target) await onReorder(id, target.id);
        }}
      >
        {content}
      </SortableProvider>
    </StateGroupPanel>
  ) : (
    <SortableProvider
      disabled={disabled}
      onSortEnd={async ({ id, index }) => {
        const target = data?.[index];
        if (target) await onReorder(id, target.id);
      }}
    >
      {content}
    </SortableProvider>
  );
}

function CategoryManagerHeader({
  label,
  addDisabled,
  onAdd,
}: {
  label: boolean;
  addDisabled: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SettingsHeading
      variant="h4"
      title={t(label ? "web.project_labels" : "web.project_statuses")}
      description={t(label ? "web.project_labels_description" : "web.project_statuses_description")}
      control={
        <Button
          stretch="auto"
          size="md"
          variant="secondary"
          label={t(label ? "web.add_project_label" : "web.add_project_status")}
          disabled={addDisabled}
          onClick={onAdd}
        />
      }
    />
  );
}

type CategoryListProps = {
  data: ProjectCategory[];
  group?: string;
  kind: CategoryKind;
  label: boolean;
  draft: Draft | null;
  disabled: boolean;
  editor: ReactNode;
  onBegin: (entry?: ProjectCategory, openColor?: boolean) => void;
  onDelete: (entry: ProjectCategory) => void;
  onMakeDefault: (entry: ProjectCategory) => void;
};

function CategoryList({
  data,
  group,
  kind,
  label,
  draft,
  disabled,
  editor,
  onBegin,
  onDelete,
  onMakeDefault,
}: CategoryListProps) {
  const { t } = useTranslation();
  return (
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
            <CategoryRow
              key={entry.id}
              entry={entry}
              index={sortableIndex}
              group={group}
              kind={kind}
              label={label}
              disabled={disabled}
              data={data}
              onBegin={onBegin}
              onDelete={onDelete}
              onMakeDefault={onMakeDefault}
            />
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
  );
}

type CategoryEditorPanelProps = {
  draft: Draft;
  kind: CategoryKind;
  group?: string;
  label: boolean;
  busy: boolean;
  colorPickerInitiallyOpen: boolean;
  editorRef: RefObject<HTMLDivElement | null>;
  onChange: (patch: Partial<Draft>) => void;
  onCancel: () => void;
  onLabelSubmit: (event: FormEvent) => void;
  onStateSubmit: (formData: Partial<IState>) => Promise<{ status: string }>;
};

function CategoryEditorPanel({
  draft,
  kind,
  group,
  label,
  busy,
  colorPickerInitiallyOpen,
  editorRef,
  onChange,
  onCancel,
  onLabelSubmit,
  onStateSubmit,
}: CategoryEditorPanelProps) {
  const { t } = useTranslation();
  return kind === "status" ? (
    <StateForm
      focusNameOnOpen={!draft.id}
      colorPickerInitiallyOpen={colorPickerInitiallyOpen}
      key={draft.id ?? "new"}
      data={{ name: draft.name, color: draft.color, description: draft.description }}
      stateGroup={phaseIcons[group ?? draft.group ?? "draft"]}
      buttonTitle={t(draft.id ? "web.update" : "web.create")}
      buttonDisabled={busy}
      onCancel={onCancel}
      onSubmit={onStateSubmit}
    />
  ) : (
    <CategoryLabelForm
      draft={draft}
      kind={kind}
      label={label}
      busy={busy}
      editorRef={editorRef}
      onChange={onChange}
      onCancel={onCancel}
      onSubmit={onLabelSubmit}
    />
  );
}

type CategoryRowProps = {
  entry: ProjectCategory;
  index: number;
  group?: string;
  kind: "status" | "label";
  label: boolean;
  disabled: boolean;
  data: ProjectCategory[];
  onBegin: (entry: ProjectCategory, openColor?: boolean) => void;
  onDelete: (entry: ProjectCategory) => void;
  onMakeDefault: (entry: ProjectCategory) => void;
};
function CategoryRow({
  entry,
  index,
  group,
  kind,
  label,
  disabled,
  data,
  onBegin,
  onDelete,
  onMakeDefault,
}: CategoryRowProps) {
  const { t } = useTranslation();
  const Glyph = label ? Tag : Circle;
  return (
    <SortableItem
      id={entry.id}
      index={index}
      group={group ?? kind}
      disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
            onClick={(event) =>
              onBegin(
                entry,
                !label && event.target instanceof Element && !!event.target.closest("[data-state-color-target]")
              )
            }
          >
            {label ? (
              entry.name
            ) : (
              <StateSummary
                icon={<StateGroupIcon stateGroup={phaseIcons[entry.group]} color={entry.color} size={EIconSize.XL} />}
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
                    disabled={disabled}
                  />
                }
              />
              <MenuContent align="end" sizing="anchor">
                <div className="min-w-30">
                  {!label && !entry.is_default && (
                    <MenuItem
                      label={t("web.project_status_make_default")}
                      icon={<Check className="size-4" />}
                      onClick={() => onMakeDefault(entry)}
                    />
                  )}
                  <MenuItem
                    label={t("edit")}
                    icon={<Pencil className="size-4" />}
                    onClick={(event) =>
                      onBegin(
                        entry,
                        !label && event.target instanceof Element && !!event.target.closest("[data-state-color-target]")
                      )
                    }
                  />
                  <MenuItem
                    label={t("delete")}
                    variant="danger"
                    icon={<Trash2 className="size-4" />}
                    disabled={
                      !label && (entry.is_default || data.filter((item) => item.group === entry.group).length <= 1)
                    }
                    onClick={() => onDelete(entry)}
                  />
                </div>
              </MenuContent>
            </Menu>
          </div>
        </>
      )}
    </SortableItem>
  );
}

type CategoryDeleteDialogProps = {
  deleting: ProjectCategory | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};
function CategoryDeleteDialog({ deleting, busy, onOpenChange, onCancel, onConfirm }: CategoryDeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={!!deleting} onOpenChange={onOpenChange}>
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
          <Button stretch="auto" size="md" variant="secondary" label={t("cancel")} disabled={busy} onClick={onCancel} />
          <Button stretch="auto" size="md" variant="primary" label={t("delete")} loading={busy} onClick={onConfirm} />
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

type CategoryLabelFormProps = {
  draft: Draft;
  kind: "status" | "label";
  label: boolean;
  busy: boolean;
  editorRef: RefObject<HTMLDivElement | null>;
  onChange: (patch: Partial<Draft>) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
};
function CategoryLabelForm({
  draft,
  kind,
  label,
  busy,
  editorRef,
  onChange,
  onCancel,
  onSubmit,
}: CategoryLabelFormProps) {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-surface-1 p-3"
    >
      <CategoryColorPicker value={draft.color} onChange={(color) => onChange({ color })} disabled={busy} kind={kind} />
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
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      {!label && (
        <textarea
          aria-label={t("web.project_status_description")}
          placeholder={t("web.project_status_description")}
          className="order-last w-full rounded-md border border-subtle p-2 text-13"
          value={draft.description ?? ""}
          maxLength={1000}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      )}
      <Button stretch="auto" size="md" variant="secondary" label={t("cancel")} disabled={busy} onClick={onCancel} />
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
  );
}
